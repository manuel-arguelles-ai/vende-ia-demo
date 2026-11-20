import { NextResponse } from 'next/server'
import { tenantDeSesion } from './sesion-helper'
import type { SesionRol } from './visibilidad'
import { obtenerNegocio } from './negocio'
import { puedeEditarSeccion, type Seccion } from './permisos'

// Devuelve la sesión si es admin; si no, un Response (401/403) listo para retornar.
export async function requireAdmin(): Promise<{ sesion: SesionRol } | { error: Response }> {
  const sesion = await tenantDeSesion()
  if (!sesion) return { error: NextResponse.json({ error: 'no autorizado' }, { status: 401 }) }
  if (sesion.rol !== 'admin') return { error: NextResponse.json({ error: 'requiere admin' }, { status: 403 }) }
  return { sesion: sesion as SesionRol }
}

// ¿El asesor tiene permiso de edición en esta sección? (admin siempre sí).
// Lee la config de permisos del inquilino (negocio.datos.permisos_asesor).
export async function asesorPuedeEditar(sesion: SesionRol, seccion: Seccion): Promise<boolean> {
  if (sesion.rol === 'admin') return true
  const negocio = await obtenerNegocio(sesion.tenantId)
  return puedeEditarSeccion(sesion, negocio.permisos_asesor, seccion)
}
