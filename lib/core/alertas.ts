import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './db'
import { scoped } from './tenant'

export type AlertaFraude = {
  id: number; remitente: string; autor: string; texto: string
  numero_detectado: string | null; telefono: string | null; created_at: string; resuelta: boolean
}

export async function registrarAlertaFraude(
  a: { tenantId: number; remitente: string; autor: 'asesor' | 'bot'; texto: string; numero?: string; telefono?: string | null },
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  try {
    const { error } = await db.from('alertas_fraude').insert({
      tenant_id: a.tenantId, remitente: a.remitente, autor: a.autor,
      texto: a.texto.slice(0, 2000), numero_detectado: a.numero ?? null, telefono: a.telefono ?? null,
    })
    if (error) console.warn('[alertas] no se pudo registrar -', error.message)
  } catch (e) {
    console.warn('[alertas] excepción -', e instanceof Error ? e.message : e)
  }
}

export async function alertasFraude(
  tenantId: number, db: SupabaseClient = supabaseAdmin(), soloPendientes = false,
): Promise<AlertaFraude[]> {
  let q = scoped(db, tenantId).from('alertas_fraude')
    .select('id,remitente,autor,texto,numero_detectado,telefono,created_at,resuelta')
    .order('created_at', { ascending: false }).limit(200)
  if (soloPendientes) q = q.eq('resuelta', false)
  const { data, error } = await q
  if (error || !data) return []
  return data as AlertaFraude[]
}

export async function resolverAlerta(id: number, tenantId: number, db: SupabaseClient = supabaseAdmin()): Promise<void> {
  await scoped(db, tenantId).from('alertas_fraude').update({ resuelta: true }).eq('id', id)
}
