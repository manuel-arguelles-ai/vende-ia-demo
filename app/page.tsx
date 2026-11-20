import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Tablero } from './tablero'
import { sesionValida, COOKIE_SESION } from '@/lib/sesion'

// Dinámica forzada: cada request evalúa la sesión acá (y en el middleware),
// nunca se sirve desde la caché estática/prerender.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const token = (await cookies()).get(COOKIE_SESION)?.value
  if (!(await sesionValida(token, process.env.AUTH_SECRET))) redirect('/login')

  return <Tablero />
}
