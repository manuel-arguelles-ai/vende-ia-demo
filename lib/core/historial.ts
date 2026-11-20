import { supabaseAdmin } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scoped } from './tenant'

// 'asesor' = mensaje enviado por el humano desde el CRM (takeover).
export type Turno = { rol: 'cliente' | 'bot' | 'asesor'; texto: string }

// Carga los últimos turnos de la conversación de un cliente (orden cronológico).
export async function cargarHistorial(
  remitente: string,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
  limite = 12,
): Promise<Turno[]> {
  const { data, error } = await scoped(db, tenantId)
    .from('mensajes')
    .select('rol,texto')
    .eq('remitente', remitente)
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error || !data) return []
  return (data as Turno[]).reverse()
}

// Guarda un turno (mensaje del cliente o del bot).
export async function guardarMensaje(
  remitente: string,
  rol: 'cliente' | 'bot' | 'asesor',
  texto: string,
  etapa: string | null = null,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  await scoped(db, tenantId).from('mensajes').insert({ remitente, rol, texto, etapa })
}
