import { type SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './db'
import { scoped } from './tenant'

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------

/**
 * Elimina todos los caracteres no numéricos de un string.
 * '+51 999-888' → '51999888'
 */
export function normalizarNumero(s: string): string {
  return s.replace(/\D/g, '')
}

// Compara dos números tolerando el prefijo país: iguales si coinciden exacto o
// en sus últimos 9 dígitos (celular Perú). Así "900000001" y "51900000001" matchean.
export function mismoNumero(a: string, b: string): boolean {
  const na = normalizarNumero(a)
  const nb = normalizarNumero(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const sa = na.slice(-9)
  return sa.length === 9 && sa === nb.slice(-9)
}

// ---------------------------------------------------------------------------
// Consulta
// ---------------------------------------------------------------------------

/**
 * Verifica si un número (o ID de remitente) está en la allowlist del tenant.
 * - Si `idOrTel` es null o no contiene dígitos → false sin tocar la DB.
 * - Tolera el prefijo país: matchea con o sin "51" (compara por sufijo de 9 díg).
 */
export async function numeroAutorizado(
  idOrTel: string | null,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<boolean> {
  if (idOrTel === null) return false
  const norm = normalizarNumero(idOrTel)
  if (norm === '') return false

  const { data, error } = await scoped(db, tenantId)
    .from('numeros_autorizados')
    .select('numero')
  if (error || !data) return false
  return (data as { numero: string }[]).some((r) => mismoNumero(r.numero, norm))
}

// ---------------------------------------------------------------------------
// Listado
// ---------------------------------------------------------------------------

export type NumeroAutorizado = {
  numero: string
  etiqueta: string | null
  created_at: string
}

/**
 * Devuelve todos los números autorizados del tenant, ordenados por fecha desc.
 */
export async function listarAutorizados(
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<NumeroAutorizado[]> {
  const { data, error } = await scoped(db, tenantId)
    .from('numeros_autorizados')
    .select('numero,etiqueta,created_at')
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as NumeroAutorizado[]
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

/**
 * Agrega o actualiza un número en la allowlist del tenant.
 * Usa upsert directo (no scoped) e inyecta tenant_id a mano.
 */
export async function agregarAutorizado(
  numero: string,
  etiqueta: string | null,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  const norm = normalizarNumero(numero)
  const { error } = await db
    .from('numeros_autorizados')
    .upsert({ tenant_id: tenantId, numero: norm, etiqueta }, { onConflict: 'tenant_id,numero' })

  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Baja
// ---------------------------------------------------------------------------

/**
 * Elimina un número de la allowlist del tenant.
 */
export async function quitarAutorizado(
  numero: string,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  await scoped(db, tenantId)
    .from('numeros_autorizados')
    .delete()
    .eq('numero', normalizarNumero(numero))
}
