import { supabaseAdmin } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scoped } from './tenant'

// Etiquetas por lead: 'manual' las pone el asesor desde el CRM,
// 'auto' las detecta Nina durante la conversación (máx 2 por turno).
export type Etiqueta = { etiqueta: string; origen: 'manual' | 'auto' }

export async function agregarEtiqueta(
  remitente: string,
  etiqueta: string,
  origen: 'manual' | 'auto' = 'manual',
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  const limpia = etiqueta.trim().toLowerCase().slice(0, 40)
  if (!limpia) return
  // upsert: si ya existe (única por remitente+etiqueta+tenant_id) no duplica ni pisa el origen
  const { error } = await db
    .from('etiquetas_leads')
    .upsert(
      { remitente, etiqueta: limpia, origen, tenant_id: tenantId },
      { onConflict: 'remitente,etiqueta,tenant_id', ignoreDuplicates: true },
    )
  if (error) throw new Error(error.message)
}

export async function quitarEtiqueta(
  remitente: string,
  etiqueta: string,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  const { error } = await scoped(db, tenantId)
    .from('etiquetas_leads')
    .delete()
    .eq('remitente', remitente)
    .eq('etiqueta', etiqueta.trim().toLowerCase())
  if (error) throw new Error(error.message)
}

// Mapa remitente → etiquetas, para adjuntar al dashboard en una sola query.
export async function etiquetasPorRemitente(
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<Map<string, Etiqueta[]>> {
  const { data, error } = await scoped(db, tenantId)
    .from('etiquetas_leads')
    .select('remitente,etiqueta,origen')
    .order('created_at', { ascending: true })
  const mapa = new Map<string, Etiqueta[]>()
  if (error || !data) return mapa
  for (const r of data as (Etiqueta & { remitente: string })[]) {
    const arr = mapa.get(r.remitente) ?? []
    arr.push({ etiqueta: r.etiqueta, origen: r.origen })
    mapa.set(r.remitente, arr)
  }
  return mapa
}
