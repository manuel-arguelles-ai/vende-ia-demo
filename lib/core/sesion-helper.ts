// Helper compartido para rutas nodejs: extrae y valida la sesión desde la cookie
// y devuelve el SesionPayload, o null si no hay sesión válida.
// Uso:
//   const sesion = await tenantDeSesion()
//   if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
//   const { tenantId } = sesion

import { cookies } from 'next/headers'
import { sesionValida, COOKIE_SESION, type SesionPayload } from '../sesion'

export async function tenantDeSesion(): Promise<SesionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_SESION)?.value
  return sesionValida(token, process.env.AUTH_SECRET)
}
