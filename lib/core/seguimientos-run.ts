// B1/B5 — Orquestador del seguimiento proactivo. Carga leads → selecciona toques →
// envía (vía sender inyectado) → registra. GATEADO por negocio.seguimiento_auto (default false):
// si el inquilino no lo activó, no hace nada. El envío real (Baileys) lo provee el worker.
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './db'
import { scoped } from './tenant'
import { obtenerNegocio } from './negocio'
import { seleccionarSeguimientos, plantillaSeguimiento, ventanaHoraria, type LeadSeguimiento } from './seguimientos'

const PERU_OFFSET = 5 // UTC-5
const horaLocalPeru = (ms: number) => ((new Date(ms).getUTCHours() - PERU_OFFSET) + 24) % 24

export type SeguimientoDeps = {
  obtenerNegocio: typeof obtenerNegocio
  cargarLeads: (tenantId: number) => Promise<LeadSeguimiento[]>
  cargarEnviados: (tenantId: number) => Promise<Map<string, Set<string>>>
  enviar: (remitente: string, texto: string) => Promise<void>
  registrarToque: (tenantId: number, remitente: string, tipo: string, toque: number) => Promise<void>
  ahoraMs: number
}

export async function procesarSeguimientos(
  tenantId: number,
  deps: SeguimientoDeps,
): Promise<{ enviados: number; motivo?: string }> {
  const negocio = await deps.obtenerNegocio(tenantId)
  if (!negocio.seguimiento_auto) return { enviados: 0, motivo: 'flag-off' }

  const [leads, enviados] = await Promise.all([deps.cargarLeads(tenantId), deps.cargarEnviados(tenantId)])
  const { apertura, cierre } = ventanaHoraria(negocio.horario)
  const seleccion = seleccionarSeguimientos(leads, {
    ahoraMs: deps.ahoraMs,
    horaLocal: horaLocalPeru(deps.ahoraMs),
    apertura,
    cierre,
    enviados,
  })
  const porRem = new Map(leads.map((l) => [l.remitente, l]))
  let ok = 0
  for (const s of seleccion) {
    const l = porRem.get(s.remitente)
    const texto = plantillaSeguimiento(s, { nombre: l?.nombre, producto: l?.producto, negocio: negocio.nombre })
    try {
      await deps.enviar(s.remitente, texto)
      await deps.registrarToque(tenantId, s.remitente, s.tipo, s.toque)
      ok++
    } catch (e) {
      console.error('[seguimientos] envío falló para', s.remitente, e)
    }
  }
  return { enviados: ok }
}

// ───────── loaders reales (best-effort; usados por el worker) ─────────

export async function cargarEnviados(tenantId: number, db: SupabaseClient = supabaseAdmin()): Promise<Map<string, Set<string>>> {
  const { data } = await scoped(db, tenantId).from('seguimientos').select('remitente,tipo,toque')
  const m = new Map<string, Set<string>>()
  for (const r of (data ?? []) as { remitente: string; tipo: string; toque: number }[]) {
    const set = m.get(r.remitente) ?? new Set<string>()
    set.add(`${r.tipo}:${r.toque}`)
    m.set(r.remitente, set)
  }
  return m
}

export async function registrarToque(tenantId: number, remitente: string, tipo: string, toque: number, db: SupabaseClient = supabaseAdmin()): Promise<void> {
  await db.from('seguimientos').insert({ tenant_id: tenantId, remitente, tipo, toque })
}

// Arma los LeadSeguimiento del inquilino cruzando mensajes (último turno) + pedido (score)
// + cierre (estado) + contacto (optout/nombre). Mira solo los últimos ~60 días.
export async function cargarLeads(tenantId: number, db: SupabaseClient = supabaseAdmin()): Promise<LeadSeguimiento[]> {
  const desde = new Date(Date.now() - 60 * 24 * 3600_000).toISOString()
  const [msgs, peds, cies, conts] = await Promise.all([
    scoped(db, tenantId).from('mensajes').select('remitente,rol,created_at').gte('created_at', desde).order('created_at', { ascending: false }).limit(5000),
    scoped(db, tenantId).from('pedidos').select('remitente,score,derivar,created_at').order('created_at', { ascending: false }).limit(5000),
    scoped(db, tenantId).from('cierres').select('remitente,estado,created_at').order('created_at', { ascending: false }).limit(3000),
    scoped(db, tenantId).from('contactos').select('remitente,nombre,productos,optout_marketing'),
  ])
  const ultimoMsg = new Map<string, { rol: string; created_at: string }>()
  for (const m of (msgs.data ?? []) as { remitente: string; rol: string; created_at: string }[])
    if (!ultimoMsg.has(m.remitente)) ultimoMsg.set(m.remitente, m)
  const ped = new Map<string, { score: number | null; derivar: boolean }>()
  for (const p of (peds.data ?? []) as { remitente: string; score: number | null; derivar: boolean }[])
    if (!ped.has(p.remitente)) ped.set(p.remitente, p)
  const cie = new Map<string, { estado: string; created_at: string }>()
  for (const c of (cies.data ?? []) as { remitente: string; estado: string; created_at: string }[])
    if (!cie.has(c.remitente)) cie.set(c.remitente, c)
  const cont = new Map<string, { nombre: string | null; productos: string[]; optout_marketing: boolean }>()
  for (const c of (conts.data ?? []) as { remitente: string; nombre: string | null; productos: string[]; optout_marketing: boolean }[])
    cont.set(c.remitente, c)

  const leads: LeadSeguimiento[] = []
  for (const [remitente, um] of ultimoMsg) {
    const c = cie.get(remitente)
    const co = cont.get(remitente)
    leads.push({
      remitente,
      score: ped.get(remitente)?.score ?? null,
      derivado: ped.get(remitente)?.derivar ?? false,
      cierreEstado: (c?.estado as LeadSeguimiento['cierreEstado']) ?? null,
      ultimoRol: (um.rol as LeadSeguimiento['ultimoRol']) ?? 'bot',
      ultimoAtMs: new Date(um.created_at).getTime(),
      ganadoAtMs: c?.estado === 'ganado' ? new Date(c.created_at).getTime() : null,
      optout: co?.optout_marketing ?? false,
      nombre: co?.nombre ?? null,
      producto: co?.productos?.[0] ?? null,
    })
  }
  return leads
}
