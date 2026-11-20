import dotenv from 'dotenv'
// Local: carga .env.local (donde viven las claves). En Railway/prod las env vars
// ya están en process.env y dotenv no las pisa; los archivos faltantes se ignoran.
dotenv.config({ path: '.env.local' })
dotenv.config()
import http from 'http'
import { sesiones, iniciarSesion, bootSesiones, ADMIN_JID } from './sesiones.js'
import { guardarMensaje } from '../lib/core/historial'
import { workerAuthOk } from './workerAuth.js'
import { notificarAdmin } from './notificarAdmin.js'

// Railway/Vercel inyectan PORT; en local cae a 3001.
http
  .createServer((req, res) => {
    const json = (code: number, body: object) => {
      res.writeHead(code, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }

    // Usa el helper puro testeado en workerAuth.ts (no duplicar la lógica).
    const authOk = () =>
      workerAuthOk(req.headers.authorization, {
        WORKER_TOKEN: process.env.WORKER_TOKEN,
        WORKER_DEV: process.env.WORKER_DEV,
      })

    // POST /enviar?tenant=X — el asesor responde desde el CRM (takeover humano).
    // Si no llega tenant, default 1 (compat con el CRM actual que no envía query param).
    if (req.method === 'POST' && req.url?.startsWith('/enviar')) {
      if (!authOk()) {
        return json(401, { error: 'no autorizado' })
      }
      manejarEnviar(req, res).catch(() => {
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end('{"error":"interno"}')
      })
      return
    }

    // POST /notificar-admin — ping best-effort al operador (el asesor) por WhatsApp
    // usando la sesión del tenant 1, sin guardar en historial. Body: { texto }.
    if (req.method === 'POST' && req.url?.startsWith('/notificar-admin')) {
      if (!authOk()) {
        return json(401, { error: 'no autorizado' })
      }
      manejarNotificarAdmin(req, res).catch(() => {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end('{"ok":false}')
      })
      return
    }

    // GET /qr?tenant=X — estado + QR del tenant. Sin tenant → tenant 1 (compat CRM viejo).
    if (req.method === 'GET' && req.url?.startsWith('/qr')) {
      if (!authOk()) {
        res.writeHead(401, { 'content-type': 'application/json' })
        res.end('{"error":"no autorizado"}')
        return
      }
      manejarQr(req, res).catch(() => {
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end('{"error":"interno"}')
      })
      return
    }

    // GET /salud — estado de todas las sesiones (monitoreo super-admin).
    if (req.method === 'GET' && req.url?.startsWith('/salud')) {
      if (!authOk()) { return json(401, { error: 'no autorizado' }) }
      const lista = [...sesiones.entries()].map(([tenantId, s]) => ({ tenantId, connected: s.connected }))
      return json(200, { sesiones: lista, uptime: Math.round(process.uptime()) })
    }

    // Página de estado HTML (visual, para el browser).
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(paginaEstado())
  })
  .listen(Number(process.env.PORT) || 3001, () => {
    console.log('Worker multi-sesión en puerto', process.env.PORT || 3001)
  })

// ---------------------------------------------------------------------------
// GET /qr?tenant=X
// ---------------------------------------------------------------------------
async function manejarQr(req: http.IncomingMessage, res: http.ServerResponse) {
  const json = (code: number, body: object) => {
    res.writeHead(code, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  const tenantId = parseTenant(req.url)
  const sesion = sesiones.get(tenantId)

  if (!sesion) {
    // On-demand: el inquilino abrió "Conectar WhatsApp" → iniciamos la sesión.
    iniciarSesion(tenantId).catch((e) =>
      console.error(`[/qr] Error iniciando sesión tenant ${tenantId}:`, e),
    )
    return json(200, { connected: false, qr: null, iniciada: true })
  }

  return json(200, { connected: sesion.connected, qr: sesion.qr, iniciada: false })
}

// ---------------------------------------------------------------------------
// POST /enviar?tenant=X
// ---------------------------------------------------------------------------
async function manejarEnviar(req: http.IncomingMessage, res: http.ServerResponse) {
  const json = (code: number, body: object) => {
    res.writeHead(code, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  const tenantId = parseTenant(req.url)
  const sesion = sesiones.get(tenantId)

  if (!sesion || !sesion.connected) {
    return json(409, { error: 'WhatsApp no conectado para este tenant' })
  }

  let cuerpo = ''
  for await (const chunk of req) {
    cuerpo += chunk
    if (cuerpo.length > 10_000) return json(413, { error: 'payload muy grande' })
  }
  let datos: { remitente?: string; texto?: string }
  try {
    datos = JSON.parse(cuerpo)
  } catch {
    return json(400, { error: 'JSON inválido' })
  }
  const { remitente, texto } = datos
  if (!remitente || !remitente.includes('@') || !texto || !texto.trim()) {
    return json(400, { error: 'remitente (jid) y texto requeridos' })
  }

  try {
    await sesion.sock.sendMessage(remitente, { text: texto.trim() })
    await guardarMensaje(remitente, 'asesor', texto.trim(), null, tenantId)
    console.log(`👤 [tenant ${tenantId}] asesor → ${remitente}: "${texto.trim().slice(0, 60)}"`)
    return json(200, { ok: true })
  } catch (err) {
    console.error(`Error enviando mensaje del asesor [tenant ${tenantId}]`, err)
    return json(500, { error: 'no se pudo enviar' })
  }
}

// ---------------------------------------------------------------------------
// POST /notificar-admin
// ---------------------------------------------------------------------------
async function manejarNotificarAdmin(req: http.IncomingMessage, res: http.ServerResponse) {
  const json = (code: number, body: object) => {
    res.writeHead(code, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  let cuerpo = ''
  for await (const chunk of req) {
    cuerpo += chunk
    if (cuerpo.length > 4_000) return json(413, { error: 'payload muy grande' })
  }
  let datos: { texto?: string }
  try {
    datos = JSON.parse(cuerpo)
  } catch {
    return json(400, { error: 'JSON inválido' })
  }

  const r = await notificarAdmin(sesiones, ADMIN_JID, datos.texto ?? '')
  return json(200, r)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parsea ?tenant=X del URL. Default: 1 (compatibilidad con el CRM actual). */
function parseTenant(url: string | undefined): number {
  if (!url) return 1
  try {
    const u = new URL(url, 'http://localhost')
    const t = Number(u.searchParams.get('tenant') ?? '1')
    return Number.isInteger(t) && t > 0 ? t : 1
  } catch {
    return 1
  }
}

function paginaEstado(): string {
  const activas = [...sesiones.entries()]
    .map(([tid, s]) => `<li>Tenant ${tid}: ${s.connected ? '✅ conectado' : s.qr ? '📷 esperando QR' : '⏳ iniciando'}</li>`)
    .join('')
  return `<!doctype html><meta charset=utf-8><meta http-equiv=refresh content=5><title>vende-ia worker</title><body style="font-family:system-ui;padding:32px"><h2>Worker vende-ia — sesiones activas</h2><ul>${activas || '<li>Sin sesiones</li>'}</ul><p style="color:#888">Actualiza cada 5s.</p></body>`
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
bootSesiones().catch((e) => {
  console.error('Error en bootSesiones:', e)
})

// B1/B5 — loop de seguimiento proactivo cada 10 min (no hace nada salvo que
// SEGUIMIENTOS_AUTO=1 y el inquilino tenga seguimiento_auto activado).
import { correrSeguimientos } from './seguimientos.js'
setInterval(() => { correrSeguimientos().catch((e) => console.error('[seguimientos] loop:', e)) }, 10 * 60 * 1000)
