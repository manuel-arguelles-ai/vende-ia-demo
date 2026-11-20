import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { PedidoGuardado } from './schemas'
import { scoped } from './tenant'

export function supabaseAdmin(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// Último estado conocido del lead (producto en foco + scoring previo).
// Lo usa atender para no perder el producto entre turnos y para no destruir
// el score de un lead caliente ante un turno troll/inyección.
export type UltimoPedido = {
  producto: string | null
  temperatura: 'caliente' | 'tibio' | 'frio'
  score: number
  derivar: boolean
}

export async function ultimoPedido(
  remitente: string,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<UltimoPedido | null> {
  const { data, error } = await scoped(db, tenantId)
    .from('pedidos')
    .select('producto,temperatura,score,derivar')
    .eq('remitente', remitente)
    .order('created_at', { ascending: false })
    .limit(5)
  if (error || !data || !data.length) return null
  const filas = data as UltimoPedido[]
  // producto en foco = el más reciente no-null dentro de los últimos turnos
  const conProducto = filas.find((f) => f.producto)
  return { ...filas[0], producto: conProducto?.producto ?? null }
}

export async function insertPedido(
  row: PedidoGuardado,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<PedidoGuardado> {
  const { id, created_at, ...insertable } = row
  const { data, error } = await scoped(db, tenantId).from('pedidos').insert(insertable).select().single()
  if (error) throw new Error(error.message)
  return data as PedidoGuardado
}
