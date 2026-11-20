import { supabaseAdmin } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scoped } from './tenant'
import { cierresPorRemitente } from './gestion'

type LeadAsignado = { remitente: string; asignado_a: number }

async function leadsAsignados(tenantId: number, db: SupabaseClient): Promise<LeadAsignado[]> {
  const { data } = await scoped(db, tenantId).from('control_leads').select('remitente,asignado_a')
  return ((data ?? []) as { remitente: string; asignado_a: number | null }[]).filter(
    (l): l is LeadAsignado => l.asignado_a != null,
  )
}

export async function cargaPorAsesor(tenantId: number, db: SupabaseClient = supabaseAdmin()): Promise<Map<number, number>> {
  const [leads, cerrados] = await Promise.all([leadsAsignados(tenantId, db), cierresPorRemitente(tenantId, db)])
  const carga = new Map<number, number>()
  for (const l of leads) {
    if (!carga.has(l.asignado_a)) carga.set(l.asignado_a, 0)
    if (cerrados.has(l.remitente)) continue   // cerrado → no cuenta como activo
    carga.set(l.asignado_a, (carga.get(l.asignado_a) ?? 0) + 1)
  }
  return carga
}

export async function kpisPorAsesor(
  tenantId: number, db: SupabaseClient = supabaseAdmin(),
): Promise<Map<number, { asignados: number; activos: number; cerrados: number; conversion: number }>> {
  const [leads, cerrados] = await Promise.all([leadsAsignados(tenantId, db), cierresPorRemitente(tenantId, db)])
  const acc = new Map<number, { asignados: number; cerrados: number }>()
  for (const l of leads) {
    const a = acc.get(l.asignado_a) ?? { asignados: 0, cerrados: 0 }
    a.asignados++
    if (cerrados.has(l.remitente)) a.cerrados++
    acc.set(l.asignado_a, a)
  }
  const out = new Map<number, { asignados: number; activos: number; cerrados: number; conversion: number }>()
  for (const [id, a] of acc) {
    out.set(id, { asignados: a.asignados, cerrados: a.cerrados, activos: a.asignados - a.cerrados, conversion: a.asignados ? a.cerrados / a.asignados : 0 })
  }
  return out
}

// Advisor selection and lead assignment logic lives in motor-eleccion.ts
// and is re-exported here to maintain a single public entry point.
export { elegirAsesor, asignarNuevoLead } from './motor-eleccion'
