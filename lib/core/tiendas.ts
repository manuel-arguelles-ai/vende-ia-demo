import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './db'
import { scoped } from './tenant'

export type Tienda = {
  id: number
  nombre: string
  direccion: string | null
  distrito: string | null
  horario: string | null
  activa: boolean
}

export async function listarTiendas(
  tenantId: number, db: SupabaseClient = supabaseAdmin(), soloActivas = false,
): Promise<Tienda[]> {
  let q = scoped(db, tenantId).from('tiendas')
    .select('id,nombre,direccion,distrito,horario,activa').order('nombre')
  if (soloActivas) q = q.eq('activa', true)
  const { data, error } = await q
  if (error || !data) return []
  return data as Tienda[]
}

export async function crearTienda(
  t: { tenantId: number; nombre: string; direccion?: string | null; distrito?: string | null; horario?: string | null },
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  const { error } = await scoped(db, t.tenantId).from('tiendas').insert({
    nombre: t.nombre, direccion: t.direccion ?? null, distrito: t.distrito ?? null, horario: t.horario ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function actualizarTienda(
  id: number, tenantId: number,
  campos: Partial<{ nombre: string; direccion: string | null; distrito: string | null; horario: string | null; activa: boolean }>,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  const { error } = await scoped(db, tenantId).from('tiendas').update(campos).eq('id', id)
  if (error) throw new Error(error.message)
}

// Baja lógica (preserva referencias en cierres).
export async function eliminarTienda(id: number, tenantId: number, db: SupabaseClient = supabaseAdmin()): Promise<void> {
  await actualizarTienda(id, tenantId, { activa: false }, db)
}

// Resuelve el nombre que emite el agente contra las tiendas del tenant (case/acentos tolerante).
export async function tiendaPorNombre(
  tenantId: number, nombre: string, db: SupabaseClient = supabaseAdmin(),
): Promise<Tienda | null> {
  const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const objetivo = norm(nombre)
  const tiendas = await listarTiendas(tenantId, db, true)
  return tiendas.find((t) => norm(t.nombre) === objetivo)
    ?? tiendas.find((t) => norm(t.nombre).includes(objetivo) || objetivo.includes(norm(t.nombre)))
    ?? null
}
