import { supabaseAdmin } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scoped } from './tenant'

// Control del takeover humano: cuando un asesor toma una conversación,
// se pausa el bot para ese remitente (Nina registra los mensajes entrantes
// pero no responde) hasta que el asesor se lo devuelva.
// Tabla control_leads: remitente (pk) + bot_pausado. Solo service role.

export async function botPausado(
  remitente: string,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<boolean> {
  const { data, error } = await scoped(db, tenantId)
    .from('control_leads')
    .select('bot_pausado')
    .eq('remitente', remitente)
    .maybeSingle()
  if (error || !data) return false
  return Boolean((data as { bot_pausado: boolean }).bot_pausado)
}

export async function setBotPausado(
  remitente: string,
  pausado: boolean,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  const { error } = await db
    .from('control_leads')
    .upsert(
      { remitente, tenant_id: tenantId, bot_pausado: pausado, actualizado: new Date().toISOString() },
      { onConflict: 'remitente,tenant_id' },
    )
  if (error) throw new Error(error.message)
}

// Set de remitentes con el bot pausado (para marcar "atención humana" en el dashboard).
export async function remitentesPausados(
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<Set<string>> {
  const { data, error } = await scoped(db, tenantId)
    .from('control_leads')
    .select('remitente')
    .eq('bot_pausado', true)
  if (error || !data) return new Set()
  return new Set((data as { remitente: string }[]).map((r) => r.remitente))
}
