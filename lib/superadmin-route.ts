// Helper para leer y validar la sesión super-admin en route handlers (Node runtime).
// Separa la lógica de autenticación del handler para evitar duplicación.
import { cookies } from 'next/headers'
import { COOKIE_SUPERADMIN, superadminValido } from '@/lib/superadmin-sesion'

/**
 * Lee la cookie vendeia_superadmin y la valida con superadminValido.
 * Devuelve el payload {superadmin:true, email} si es válida, o null si no.
 * Solo da acceso cuando la cookie es de super-admin; una cookie normal de tenant
 * (vendeia_sesion) no es leída aquí y no otorga acceso.
 */
export async function sesionSuperadmin() {
  const jar = await cookies()
  const cookieVal = jar.get(COOKIE_SUPERADMIN)
  const token = cookieVal?.value
  const secret = process.env.SUPERADMIN_SECRET ?? process.env.AUTH_SECRET ?? ''
  return superadminValido(token, secret)
}
