import { supabaseAdmin } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scoped } from './tenant'

// Gestión del ciclo de venta: cierres (ganado/perdido), notas internas y
// recordatorios de follow-up. La última fila de cierres define el estado.

export type EstadoCierre = 'ganado' | 'perdido' | 'reabierto' | 'reservada'
export type Cierre = { estado: EstadoCierre; monto: number | null; tipo?: 'venta' | 'reserva' | null; tienda_id?: number | null }
export type Nota = { id: number; texto: string; created_at: string }
export type Recordatorio = { id: number; remitente: string; cuando: string; nota: string | null; hecho: boolean }

export async function registrarCierre(
  remitente: string,
  estado: Cierre['estado'],
  monto: number | null = null,
  motivo: string | null = null,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
  opts: { tipo?: 'venta' | 'reserva' | null; tiendaId?: number | null } = {},
): Promise<void> {
  const fila: Record<string, unknown> = { remitente, estado, monto, motivo }
  if (opts.tipo !== undefined) fila.tipo = opts.tipo
  if (opts.tiendaId !== undefined) fila.tienda_id = opts.tiendaId
  const { error } = await scoped(db, tenantId).from('cierres').insert(fila)
  if (error) throw new Error(error.message)
}

// Mapa remitente → último cierre (ignora 'reabierto', que vuelve el lead al pipeline).
export async function cierresPorRemitente(
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<Map<string, Cierre>> {
  const { data, error } = await scoped(db, tenantId)
    .from('cierres')
    .select('remitente,estado,monto,tipo,tienda_id,created_at')
  const mapa = new Map<string, Cierre>()
  if (error || !data) return mapa
  const sorted = (data as (Cierre & { remitente: string; created_at: string })[])
    .slice()
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  for (const r of sorted) {
    if (r.estado === 'reabierto') mapa.delete(r.remitente)
    else mapa.set(r.remitente, { estado: r.estado, monto: r.monto === null ? null : Number(r.monto), tipo: r.tipo ?? null, tienda_id: r.tienda_id ?? null })
  }
  return mapa
}

export async function agregarNota(
  remitente: string,
  texto: string,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  const { error } = await scoped(db, tenantId).from('notas').insert({ remitente, texto: texto.trim().slice(0, 1000) })
  if (error) throw new Error(error.message)
}

export async function listarNotas(
  remitente: string,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<Nota[]> {
  const { data, error } = await scoped(db, tenantId)
    .from('notas')
    .select('id,texto,created_at')
    .eq('remitente', remitente)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error || !data) return []
  return data as Nota[]
}

export async function crearRecordatorio(
  remitente: string,
  cuando: string,
  nota: string | null,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  const { error } = await scoped(db, tenantId).from('recordatorios').insert({ remitente, cuando, nota })
  if (error) throw new Error(error.message)
}

export async function marcarRecordatorio(
  id: number,
  hecho: boolean,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
  visibles: string[] | null = null,
): Promise<void> {
  // visibles != null (asesor) → solo puede marcar recordatorios de sus leads.
  let q = scoped(db, tenantId).from('recordatorios').update({ hecho }).eq('id', id)
  if (visibles !== null) q = q.in('remitente', visibles)
  const { error } = await q
  if (error) throw new Error(error.message)
}

// Recordatorios pendientes por remitente (para badges y la lista del panel).
export async function recordatoriosPendientes(
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<Recordatorio[]> {
  const { data, error } = await scoped(db, tenantId)
    .from('recordatorios')
    .select('id,remitente,cuando,nota,hecho')
    .eq('hecho', false)
    .order('cuando', { ascending: true })
  if (error || !data) return []
  return data as Recordatorio[]
}
