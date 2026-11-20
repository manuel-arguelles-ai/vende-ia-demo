import { supabaseAdmin } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scoped } from './tenant'
import { obtenerNegocio, guardarNegocio } from './negocio'
import { asignarLead } from './asignacion'
import { cargaPorAsesor } from './motor-asignacion'

type Asesor = { id: number; peso: number; limite: number | null }

async function asesoresActivos(tenantId: number, db: SupabaseClient): Promise<Asesor[]> {
  const { data } = await scoped(db, tenantId).from('usuarios').select('id,peso,limite_activos,rol,activo')
  return ((data ?? []) as { id: number; peso: number | null; limite_activos: number | null; rol: string; activo: boolean }[])
    .filter((u) => u.rol === 'asesor' && u.activo)
    .map((u) => ({ id: u.id, peso: u.peso ?? 1, limite: u.limite_activos ?? null }))
    .sort((a, b) => a.id - b.id)
}

export async function elegirAsesor(tenantId: number, db: SupabaseClient = supabaseAdmin()): Promise<number | null> {
  const negocio = await obtenerNegocio(tenantId, db)
  const cfg = negocio.asignacion
  if (!cfg || cfg.regla === 'off') return null
  const asesores = await asesoresActivos(tenantId, db)
  if (asesores.length === 0) return null
  const carga = await cargaPorAsesor(tenantId, db)
  const cargaDe = (id: number) => carga.get(id) ?? 0
  const limiteDe = (a: Asesor) => a.limite ?? cfg.limite_default
  const noSaturados = asesores.filter((a) => cargaDe(a.id) < limiteDe(a))
  const elegibles = noSaturados.length > 0 ? noSaturados : asesores  // todos saturados → todos elegibles (caerá al menos cargado)
  const todosSaturados = noSaturados.length === 0

  if (cfg.regla === 'carga' || todosSaturados) {
    // menor carga, desempate por id
    return elegibles.slice().sort((a, b) => (cargaDe(a.id) - cargaDe(b.id)) || (a.id - b.id))[0].id
  }
  if (cfg.regla === 'round_robin') {
    const ids = elegibles.map((a) => a.id)  // ya ordenados por id
    const next = ids.find((id) => id > (cfg.ultimo_asesor_id ?? 0))
    return next ?? ids[0]
  }
  if (cfg.regla === 'ponderada') {
    // lista expandida por peso, ordenada por id; el siguiente tras la última posición del ultimo_asesor_id
    const expandida: number[] = []
    for (const a of elegibles) for (let i = 0; i < Math.max(1, a.peso); i++) expandida.push(a.id)
    if (expandida.length === 0) return elegibles[0].id
    const lastIdx = cfg.ultimo_asesor_id == null ? -1 : expandida.lastIndexOf(cfg.ultimo_asesor_id)
    return expandida[(lastIdx + 1) % expandida.length]
  }
  return elegibles[0].id
}

export async function asignarNuevoLead(
  remitente: string, tenantId: number, db: SupabaseClient = supabaseAdmin(),
): Promise<number | null> {
  // ¿ya asignado?
  const { data: lead } = await scoped(db, tenantId).from('control_leads').select('asignado_a').eq('remitente', remitente).maybeSingle()
  const yaAsignado = (lead as { asignado_a: number | null } | null)?.asignado_a ?? null
  if (yaAsignado != null) return yaAsignado
  const elegido = await elegirAsesor(tenantId, db)
  if (elegido == null) return null
  await asignarLead(remitente, elegido, tenantId, db)
  const negocio = await obtenerNegocio(tenantId, db)
  const cfg = negocio.asignacion ?? { regla: 'off' as const, limite_default: 20, ultimo_asesor_id: null }
  await guardarNegocio({ ...negocio, asignacion: { ...cfg, ultimo_asesor_id: elegido } }, tenantId, db)
  return elegido
}
