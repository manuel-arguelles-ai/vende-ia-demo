import { supabaseAdmin } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { remitentesAsignados } from './asignacion'

export type SesionRol = { usuarioId: number; tenantId: number; rol: string }

export function esAdmin(sesion: SesionRol): boolean {
  return sesion.rol === 'admin'
}

// null = sin filtro (admin ve todo); array = filtrar por esos remitentes (asesor).
export async function remitentesVisibles(
  sesion: SesionRol,
  db: SupabaseClient = supabaseAdmin(),
): Promise<string[] | null> {
  if (esAdmin(sesion)) return null
  return remitentesAsignados(sesion.usuarioId, sesion.tenantId, db)
}

// ¿La sesión puede operar sobre este remitente? Admin siempre; asesor solo
// si el lead está asignado a él. Guard de autorización para rutas por-remitente.
export async function puedeVerRemitente(
  sesion: SesionRol,
  remitente: string,
  db: SupabaseClient = supabaseAdmin(),
): Promise<boolean> {
  const visibles = await remitentesVisibles(sesion, db)
  if (visibles === null) return true
  return visibles.includes(remitente)
}
