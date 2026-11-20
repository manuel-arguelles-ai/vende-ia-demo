import { supabaseAdmin } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scoped } from './tenant'

export async function asignarLead(
  remitente: string,
  usuarioId: number | null,
  tenantId: number,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  if (usuarioId != null) {
    const { data: u } = await scoped(db, tenantId).from('usuarios').select('id').eq('id', usuarioId).maybeSingle()
    if (!u) throw new Error('USUARIO_FUERA_DE_TENANT: el asesor no pertenece a este tenant')
  }
  const { error } = await db
    .from('control_leads')
    .upsert(
      { remitente, tenant_id: tenantId, asignado_a: usuarioId, actualizado: new Date().toISOString() },
      { onConflict: 'remitente,tenant_id' },
    )
  if (error) throw new Error(error.message)
}

export async function remitentesAsignados(
  usuarioId: number,
  tenantId: number,
  db: SupabaseClient = supabaseAdmin(),
): Promise<string[]> {
  const { data } = await scoped(db, tenantId).from('control_leads').select('remitente').eq('asignado_a', usuarioId)
  return ((data ?? []) as { remitente: string }[]).map((r) => r.remitente)
}
