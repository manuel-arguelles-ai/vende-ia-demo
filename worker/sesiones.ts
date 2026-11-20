/**
 * Session manager — Map<tenantId, Sesion>
 * Una sesión Baileys por inquilino, aisladas en WA_AUTH_DIR/<tenantId>/.
 */

import path from 'path'
import fs from 'fs'
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  downloadMediaMessage,
  type WAMessage,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
import pino from 'pino'
import { atender } from '../lib/core/atender'
import { interpretarImagen, planTieneVision } from '../lib/core/vision'
import { obtenerTenantPlan, planTieneVoz } from '../lib/core/plataforma'
import { registrarConsumo } from '../lib/core/limites'
import { avisoHandoff } from '../lib/core/handoff'
import { supabaseAdmin } from '../lib/core/db'
import { guardarMensaje } from '../lib/core/historial'
import { transcribir } from './voz/stt'
import { sintetizar } from './voz/tts'
import { redactarTexto, redactarRemitente } from '../lib/core/redaccion'
import { registrarEvento } from '../lib/core/eventos'

const logger = pino({ level: 'warn' })

export type Sock = ReturnType<typeof makeWASocket>

export interface Sesion {
  sock: Sock
  qr: string | null
  connected: boolean
  tenantId: number
}

/** Map global de sesiones activas. Exportado para los endpoints HTTP. */
export const sesiones = new Map<number, Sesion>()

/** Leído en runtime para que los tests puedan sobreescribir process.env.WA_AUTH_DIR. */
function getWaAuthDir(): string {
  return process.env.WA_AUTH_DIR ?? './.wa-auth'
}

/**
 * Borra el authDir de un tenant. Se usa cuando la sesión queda `loggedOut`:
 * las credenciales muertas impiden que Baileys emita un QR nuevo (intenta
 * reautenticar con ellas → loggedOut → loop), así que hay que limpiarlas para
 * que el siguiente `iniciarSesion` arranque limpio y genere el QR de re-vínculo.
 */
export function limpiarAuthDir(tenantId: number): boolean {
  const dir = path.join(getWaAuthDir(), String(tenantId))
  try {
    fs.rmSync(dir, { recursive: true, force: true })
    return true
  } catch (e) {
    console.error(`[tenant ${tenantId}] no se pudo limpiar authDir:`, e)
    return false
  }
}

// Destino del aviso de leads calientes (asesor humano de Nina).
// NOTA: el aviso de handoff queda SOLO para tenant 1 (Nina). Los otros inquilinos
// atienden con el bot + takeover desde el CRM; el aviso por WhatsApp saliente es
// parte del sub-proyecto multi-asesor (fuera de alcance de esta tarea).
export const ADMIN_JID = process.env.ADMIN_WHATSAPP
  ? `${process.env.ADMIN_WHATSAPP.replace(/\D/g, '')}@s.whatsapp.net`
  : null

// Evita re-avisar por el mismo cliente en cada mensaje caliente (por sesión de proceso).
const yaAvisados = new Set<string>()

// ---------------------------------------------------------------------------
// resolverTelefono — sin cambios respecto al worker original.
// ---------------------------------------------------------------------------
async function resolverTelefono(
  key: { remoteJid?: string | null; remoteJidAlt?: string | null },
  sock: Sock,
): Promise<string | null> {
  const alt = key.remoteJidAlt
  if (alt && alt.endsWith('@s.whatsapp.net')) return alt
  const jid = key.remoteJid ?? ''
  if (jid.endsWith('@s.whatsapp.net')) return jid
  if (jid.endsWith('@lid')) {
    try {
      const pn = await sock.signalRepository.lidMapping.getPNForLID(jid)
      if (pn) return pn
    } catch { /* sin mapeo conocido todavía */ }
  }
  return null
}

// ---------------------------------------------------------------------------
// backfillTelefonos — recibe sock y tenantId de la sesión (sin cambios de lógica).
// ---------------------------------------------------------------------------
async function backfillTelefonos(sock: Sock, tenantId: number): Promise<void> {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('pedidos')
    .select('id,remitente,extra')
    .eq('tenant_id', tenantId)
    .like('remitente', '%@lid')
    .order('created_at', { ascending: false })
  if (error || !data) return
  const vistos = new Set<string>()
  let n = 0
  for (const row of data as { id: number; remitente: string; extra: Record<string, unknown> | null }[]) {
    if (vistos.has(row.remitente)) continue
    vistos.add(row.remitente)
    if (row.extra && typeof row.extra._tel === 'string') continue
    let pn: string | null = null
    try { pn = await sock.signalRepository.lidMapping.getPNForLID(row.remitente) } catch { /* ignore */ }
    if (!pn) continue
    await db.from('pedidos').update({ extra: { ...(row.extra ?? {}), _tel: pn } }).eq('id', row.id).eq('tenant_id', tenantId)
    n++
  }
  if (n) console.log(`[tenant ${tenantId}] backfill: ${n} teléfonos resueltos desde LID`)
}

// ---------------------------------------------------------------------------
// Handler de mensajes entrantes (por sesión / tenantId).
// Mueve la lógica del messages.upsert original; no cambia atender ni voz.
// ---------------------------------------------------------------------------
// Estados/difusiones/grupos/newsletters NO son conversaciones de cliente: ignorarlos
// (si no, un "estado" de WhatsApp del dueño del número se ingiere como un lead).
export function esJidIgnorable(jid?: string | null): boolean {
  if (!jid) return true
  return jid === 'status@broadcast' || jid.endsWith('@broadcast') || jid.endsWith('@g.us') || jid.endsWith('@newsletter')
}

async function manejarMensaje(m: WAMessage, sock: Sock, tenantId: number) {
  if (m.key.fromMe || !m.message) return
  const remitente = m.key.remoteJid!
  if (esJidIgnorable(remitente)) return
  let texto =
    m.message.conversation ??
    m.message.extendedTextMessage?.text ??
    m.message.imageMessage?.caption ??
    m.message.videoMessage?.caption ??
    ''
  const audio = m.message.audioMessage
  const adjunto = m.message.imageMessage || m.message.videoMessage || m.message.documentMessage
  let esVoz = false
  let comprobante: { monto: number | null; titular?: string | null; operacion?: string | null } | undefined

  if (!texto.trim() && audio) {
    // Gate por plan: la transcripción (Groq) es de planes con voz; free no la usa.
    const { plan } = await obtenerTenantPlan(tenantId)
    if (!planTieneVoz(plan)) {
      await sock.sendMessage(remitente, {
        text: 'Recibí tu audio 🎙️ pero en tu plan no puedo escucharlo. Escribime tu consulta y te ayudo 😊',
      })
      return
    }
    try {
      const buf = (await downloadMediaMessage(m, 'buffer', {})) as Buffer
      const t = await transcribir(buf, audio.mimetype || 'audio/ogg')
      if (t.ok && t.texto.trim()) {
        texto = t.texto
        esVoz = true
        // Medición de voz entrante (driver del costo Groq), best-effort.
        const segs = Math.round(Number(audio.seconds) || 0)
        if (segs > 0) {
          registrarConsumo(tenantId, { segundosVoz: segs }).catch((e) =>
            console.error(`[tenant ${tenantId}] registrarConsumo (voz) falló`, e),
          )
        }
        console.log(`🎙️  voz→texto [tenant ${tenantId}]: ${redactarTexto(texto)}`)
      } else {
        console.warn(`STT falló [tenant ${tenantId}]:`, t.error)
        await sock.sendMessage(remitente, {
          text: 'Recibí tu audio pero no pude escucharlo bien. ¿Me lo escribís o lo mandás de nuevo?',
        })
        return
      }
    } catch (e) {
      console.error(`Error descargando/transcribiendo audio [tenant ${tenantId}]`, e)
      return
    }
  }

  const imagen = m.message.imageMessage
  if (!texto.trim() && imagen) {
    const { plan } = await obtenerTenantPlan(tenantId)
    if (!planTieneVision(plan)) {
      await sock.sendMessage(remitente, {
        text: 'Recibí tu foto 📷 pero en tu plan no puedo verla. Escribime qué producto buscás y te ayudo 😊',
      })
      return
    }
    try {
      const buf = (await downloadMediaMessage(m, 'buffer', {})) as Buffer
      const interp = await interpretarImagen(buf, imagen.mimetype || 'image/jpeg')
      if (interp?.tipo === 'pago') {
        comprobante = { monto: interp.monto, titular: interp.titular, operacion: interp.operacion }
        texto = `[Comprobante de pago Yape/Plin: S/ ${interp.monto ?? '?'}]`
        console.log(`🧾 comprobante [tenant ${tenantId}]: S/${interp.monto} op ${interp.operacion}`)
      } else if (interp?.tipo === 'producto' && interp.descripcion) {
        texto = interp.descripcion
        console.log(`🖼️  foto→texto [tenant ${tenantId}]: ${redactarTexto(texto)}`)
      } else {
        await sock.sendMessage(remitente, {
          text: 'Vi que mandaste una foto pero no pude procesarla, ¿me decís qué producto buscás? 😊',
        })
        return
      }
    } catch (e) {
      console.error(`Error descargando/describiendo imagen [tenant ${tenantId}]`, e)
      await sock.sendMessage(remitente, {
        text: 'Vi que mandaste una foto pero no pude procesarla, ¿me decís qué producto buscás? 😊',
      })
      return
    }
  } else if (!texto.trim() && adjunto) {
    // video / documento sin texto → fallback genérico (sin visión)
    await sock.sendMessage(remitente, {
      text: 'Recibí tu archivo 📎, pero todavía no puedo verlo. ¿Me decís en texto o audio qué necesitás (por ej. el producto) y te ayudo? 😊',
    })
    return
  }
  if (!texto.trim()) return

  try {
    const telefono = await resolverTelefono(m.key, sock)
    const r = await atender({ mensaje: texto, canal: 'whatsapp', remitente, telefono, tenantId, comprobante })
    if (r.silenciado) {
      console.log(`👤 [tenant ${tenantId}][en atención humana] ${redactarTexto(texto)} — bot en silencio`)
      return
    }
    await sock.sendMessage(remitente, { text: r.respuesta })

    const modoVoz = (process.env.VOZ_RESPONDER || 'mirror').toLowerCase()
    if (r.respuesta && (modoVoz === 'always' || (modoVoz === 'mirror' && esVoz))) {
      const v = await sintetizar(r.respuesta)
      if (v.ok && v.ogg) {
        await sock.sendMessage(remitente, { audio: v.ogg, ptt: true, mimetype: 'audio/ogg; codecs=opus' })
      } else {
        console.warn(`TTS falló [tenant ${tenantId}] (queda solo el texto):`, v.error)
      }
    }
    console.log(`[tenant ${tenantId}][${r.etapa}]${esVoz ? ' 🎙️' : ''} ${redactarTexto(texto)}  ->  ${r.saved?.temperatura} (${r.saved?.score})${r.derivar ? '  🔥 DERIVAR: ' + r.handoff : ''}`)

    // Aviso de lead caliente al asesor humano → SOLO para tenant 1 (Nina).
    // Multi-asesor (handoff per-tenant) es fuera de alcance; otros inquilinos
    // usan takeover desde el CRM sin aviso WhatsApp saliente.
    if (tenantId === 1 && r.derivar && r.saved && ADMIN_JID && remitente !== ADMIN_JID && !yaAvisados.has(remitente)) {
      yaAvisados.add(remitente)
      await sock.sendMessage(ADMIN_JID, {
        text: avisoHandoff({ remitente, handoff: r.handoff, saved: r.saved, telefono }),
      })
      console.log(`   📨 aviso de lead caliente enviado al asesor (${redactarRemitente(ADMIN_JID)})`)
    }
  } catch (err) {
    console.error(`Error procesando mensaje [tenant ${tenantId}]`, err)
    await sock.sendMessage(remitente, {
      text: 'Disculpa, tuvimos un problema. Un asesor te escribe en breve.',
    })
  }
}

// ---------------------------------------------------------------------------
// iniciarSesion — idempotente: si ya hay sesión conectada para el tenant, no duplica.
// ---------------------------------------------------------------------------
export async function iniciarSesion(tenantId: number): Promise<Sesion> {
  const existente = sesiones.get(tenantId)
  if (existente && existente.connected) {
    console.log(`[sesiones] tenant ${tenantId} ya conectado — no se duplica`)
    return existente
  }

  const authDir = path.join(getWaAuthDir(), String(tenantId))
  fs.mkdirSync(authDir, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false })

  const sesion: Sesion = { sock, qr: null, connected: false, tenantId }
  sesiones.set(tenantId, sesion)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect, qr } = u

    if (qr) {
      sesion.qr = null // se sobreescribirá con data URL
      console.log(`\n[tenant ${tenantId}] Escaneá el QR para vincular WhatsApp:\n`)
      qrcode.generate(qr, { small: true })
      QRCode.toDataURL(qr, { width: 320, margin: 2 })
        .then((d) => { sesion.qr = d })
        .catch(() => {})
    }

    if (connection === 'open') {
      sesion.connected = true
      sesion.qr = null
      console.log(`[tenant ${tenantId}] WhatsApp conectado.`)
      // Bitácora de plataforma (best-effort).
      registrarEvento('whatsapp_conectado', tenantId, {})
      backfillTelefonos(sock, tenantId).catch((e) =>
        console.error(`backfill tel error [tenant ${tenantId}]`, e),
      )
    }

    if (connection === 'close') {
      sesion.connected = false
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode
      const reloguear = code !== DisconnectReason.loggedOut
      console.log(`[tenant ${tenantId}] Conexión cerrada. Reconectar?`, reloguear)
      if (reloguear) {
        // Eliminar del Map antes de reconectar (para que iniciarSesion no lo vea "conectado").
        sesiones.delete(tenantId)
        iniciarSesion(tenantId).catch((e) =>
          console.error(`Error reconectando tenant ${tenantId}`, e),
        )
      } else {
        // Sesión deslogueada: eliminar del Map Y limpiar el authDir. Sin esto, las
        // credenciales muertas quedan en disco y el siguiente iniciarSesion (p.ej. el
        // polling del modal /qr) reintenta con ellas → loggedOut otra vez → loop sin QR.
        sesiones.delete(tenantId)
        limpiarAuthDir(tenantId)
        console.log(`[tenant ${tenantId}] Deslogueado. authDir limpiado; pedí el QR para re-vincular.`)
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const m of messages) {
      await manejarMensaje(m, sock, tenantId).catch((e) =>
        console.error(`Error en manejarMensaje [tenant ${tenantId}]`, e),
      )
    }
  })

  return sesion
}

// ---------------------------------------------------------------------------
// migrarPlana — CRÍTICO: mueve auth plana → WA_AUTH_DIR/1/ si corresponde.
// Condición: existe WA_AUTH_DIR/creds.json Y NO existe WA_AUTH_DIR/1.
// ---------------------------------------------------------------------------
export async function migrarPlana(): Promise<void> {
  const waAuthDir = getWaAuthDir()
  const credsPlanos = path.join(waAuthDir, 'creds.json')
  const dirTenant1 = path.join(waAuthDir, '1')

  const hayCredsPlanos = fs.existsSync(credsPlanos)
  const hayDirTenant1 = fs.existsSync(dirTenant1)

  if (!hayCredsPlanos) {
    console.log('[migrarPlana] No hay auth plana en WA_AUTH_DIR — nada que migrar.')
    return
  }
  if (hayDirTenant1) {
    console.log('[migrarPlana] WA_AUTH_DIR/1 ya existe — migración previa detectada, se omite.')
    return
  }

  console.log('[migrarPlana] Detectada auth plana de Nina. Migrando a WA_AUTH_DIR/1/ ...')
  try {
    fs.mkdirSync(dirTenant1, { recursive: true })

    // Mover todos los archivos .json (creds.json + archivos de keys de Baileys) al subdir 1/.
    // NO se eliminan directorios (keys/ puede ser un subdir).
    const entries = fs.readdirSync(waAuthDir, { withFileTypes: true })
    let movidos = 0
    for (const entry of entries) {
      if (entry.isDirectory()) continue // subdirectorios (ej. si existieran otros tenants)
      if (!entry.name.endsWith('.json')) continue // solo archivos de auth de Baileys

      const src = path.join(waAuthDir, entry.name)
      const dst = path.join(dirTenant1, entry.name)
      fs.renameSync(src, dst)
      console.log(`[migrarPlana]   movido: ${entry.name} → 1/${entry.name}`)
      movidos++
    }
    console.log(`[migrarPlana] Migración completada. ${movidos} archivo(s) movido(s). Nina reconectará como tenant 1.`)
  } catch (err) {
    console.error('[migrarPlana] ERROR durante la migración de Nina:', err)
    console.error('[migrarPlana] ATENCIÓN: Nina podría necesitar re-escanear QR. Verificar WA_AUTH_DIR manualmente.')
    // No re-throw: el worker continúa; en el peor caso Nina pide QR de nuevo.
  }
}

// ---------------------------------------------------------------------------
// bootSesiones — ejecutar al arrancar el worker.
// ---------------------------------------------------------------------------
export async function bootSesiones(): Promise<void> {
  // 1. Migración de Nina (crítico, sin downtime).
  await migrarPlana()

  // 2. Escanear subdirs numéricos de WA_AUTH_DIR y reconectar cada sesión persistida.
  const waAuthDir = getWaAuthDir()
  let entries: fs.Dirent[] = []
  try {
    fs.mkdirSync(waAuthDir, { recursive: true })
    entries = fs.readdirSync(waAuthDir, { withFileTypes: true })
  } catch (e) {
    console.error('[bootSesiones] No se pudo leer WA_AUTH_DIR:', e)
    return
  }

  const tenantIds: number[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const n = Number(entry.name)
    if (!Number.isInteger(n) || n <= 0) continue // ignorar subdirs no numéricos
    const credsFile = path.join(waAuthDir, entry.name, 'creds.json')
    if (!fs.existsSync(credsFile)) continue // subdir sin auth — saltar
    tenantIds.push(n)
  }

  console.log(`[bootSesiones] ${tenantIds.length} sesión(es) a reconectar: ${tenantIds.join(', ') || 'ninguna'}`)

  // Iniciar en paralelo (cada una maneja su propia reconexión).
  await Promise.allSettled(
    tenantIds.map((id) =>
      iniciarSesion(id).catch((e) => console.error(`[bootSesiones] Error iniciando tenant ${id}:`, e)),
    ),
  )

  console.log(`[bootSesiones] Sesiones activas: ${sesiones.size}`)
}
