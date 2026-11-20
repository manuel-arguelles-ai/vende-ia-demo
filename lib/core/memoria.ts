import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './db'
import { scoped } from './tenant'
import { cargarHistorial, type Turno } from './historial'
import { resumirParaMemoria as resumirMemReal } from './resumir'

export const VENTANA = 20
const LOTE = 10

export async function obtenerResumen(
  remitente: string, tenantId: number, db: SupabaseClient = supabaseAdmin(),
): Promise<{ resumen: string; turnos_resumidos: number } | null> {
  const { data } = await scoped(db, tenantId).from('resumen_lead')
    .select('resumen,turnos_resumidos').eq('remitente', remitente).maybeSingle()
  return (data as { resumen: string; turnos_resumidos: number } | null) ?? null
}

export async function guardarResumen(
  a: { tenantId: number; remitente: string; resumen: string; turnos: number }, db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  await scoped(db, a.tenantId).from('resumen_lead').upsert(
    { remitente: a.remitente, resumen: a.resumen, turnos_resumidos: a.turnos, updated_at: new Date().toISOString() },
    { onConflict: 'remitente,tenant_id' },
  )
}

// Ventana reciente + resumen previo (lo anterior a la ventana).
export async function cargarContexto(
  remitente: string, tenantId: number, db: SupabaseClient = supabaseAdmin(), ventana: number = VENTANA,
): Promise<{ resumen: string | null; turnos: Turno[] }> {
  const turnos = await cargarHistorial(remitente, tenantId, db, ventana)
  const r = await obtenerResumen(remitente, tenantId, db)
  return { resumen: r?.resumen ?? null, turnos }
}

// Regenera el resumen por lotes cuando hay turnos nuevos fuera de la ventana.
// El umbral se deriva de la ventana (ventana + LOTE) para que la memoria sea
// coherente con cualquier tamaño de ventana configurado por el inquilino.
// Best-effort: nunca lanza (lo llama atender fire-and-forget).
export async function quizasResumir(
  remitente: string, tenantId: number, db: SupabaseClient = supabaseAdmin(),
  resumir: typeof resumirMemReal = resumirMemReal, ventana: number = VENTANA,
): Promise<void> {
  try {
    const todos = await cargarHistorial(remitente, tenantId, db, 200)
    if (todos.length <= ventana + LOTE) return
    const hasta = todos.length - ventana
    const prev = await obtenerResumen(remitente, tenantId, db)
    if (hasta - (prev?.turnos_resumidos ?? 0) < LOTE) return
    const antiguos = todos.slice(0, hasta)
    const resumen = await resumir(antiguos, prev?.resumen)
    await guardarResumen({ tenantId, remitente, resumen, turnos: hasta }, db)
  } catch (e) {
    console.warn('[memoria] quizasResumir', e instanceof Error ? e.message : e)
  }
}
