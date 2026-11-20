import { supabaseAdmin } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scoped } from './tenant'
import { PLANES } from './plataforma'

export function periodoActual(ahora: Date = new Date()): string {
  const y = ahora.getFullYear()
  const m = String(ahora.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function limitesDe(plan: string): { mensajes_mes: number; asesores: number; voz: boolean } {
  const p = (PLANES as Record<string, { limites: { mensajes_mes: number; asesores: number; voz: boolean } }>)[plan]
  return p ? p.limites : PLANES.free.limites
}

export async function registrarConsumo(
  tenantId: number,
  datos: { mensajes?: number; tokens?: number; segundosVoz?: number },
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  await db.rpc('incr_consumo', {
    p_tenant_id: tenantId,
    p_periodo: periodoActual(),
    p_mensajes: datos.mensajes ?? 0,
    p_tokens: datos.tokens ?? 0,
    p_segundos_voz: datos.segundosVoz ?? 0,
  })
}

export async function consumoDelMes(
  tenantId: number, db: SupabaseClient = supabaseAdmin(),
): Promise<{ mensajes: number; tokens_llm: number; segundos_voz: number }> {
  const { data } = await scoped(db, tenantId).from('consumo').select('mensajes,tokens_llm,segundos_voz').eq('periodo', periodoActual()).maybeSingle()
  const r = data as { mensajes: number; tokens_llm: number; segundos_voz: number } | null
  return r ?? { mensajes: 0, tokens_llm: 0, segundos_voz: 0 }
}

export type EstadoLimite = { excedido: boolean; bloquear: boolean; usados: number; limite: number | null }

export async function estadoLimiteMensajes(
  tenantId: number, plan: string, subEstado: string | null, db: SupabaseClient = supabaseAdmin(),
): Promise<EstadoLimite> {
  const lim = limitesDe(plan).mensajes_mes
  const limite = lim && lim > 0 ? lim : null    // 0/ausente = ilimitado
  const { mensajes: usados } = await consumoDelMes(tenantId, db)
  const excedido = limite != null && usados >= limite
  const bloquear = excedido && (plan === 'free' || subEstado === 'trial')
  return { excedido, bloquear, usados, limite }
}

export async function puedeAgregarAsesor(
  tenantId: number, plan: string, db: SupabaseClient = supabaseAdmin(),
): Promise<boolean> {
  const cupo = limitesDe(plan).asesores
  if (!cupo || cupo <= 0) return true   // 0 = ilimitado
  const { data } = await scoped(db, tenantId).from('usuarios').select('id').eq('rol', 'asesor')
  return ((data ?? []) as unknown[]).length < cupo
}
