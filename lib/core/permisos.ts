import { esAdmin, type SesionRol } from './visibilidad'

// Permisos del asesor por sección, configurables por el admin del inquilino.
// Se guardan en negocio.datos.permisos_asesor. Default (si falta) = 'editar'
// (compat con el comportamiento previo: el asesor veía y editaba todo).
export type Seccion = 'pipeline' | 'contactos' | 'pedidos' | 'catalogo'
export type Permiso = 'editar' | 'ver' | 'oculto'
export type PermisosAsesor = Partial<Record<Seccion, Permiso>>

export function permisoDe(permisos: PermisosAsesor | undefined, seccion: Seccion): Permiso {
  return permisos?.[seccion] ?? 'editar'
}

// ¿La sección es visible para esta sesión? Admin siempre; asesor si no está 'oculto'.
export function seccionVisible(sesion: SesionRol, permisos: PermisosAsesor | undefined, seccion: Seccion): boolean {
  if (esAdmin(sesion)) return true
  return permisoDe(permisos, seccion) !== 'oculto'
}

// ¿Puede editar en la sección? Admin siempre; asesor solo con permiso 'editar'.
export function puedeEditarSeccion(sesion: SesionRol, permisos: PermisosAsesor | undefined, seccion: Seccion): boolean {
  if (esAdmin(sesion)) return true
  return permisoDe(permisos, seccion) === 'editar'
}
