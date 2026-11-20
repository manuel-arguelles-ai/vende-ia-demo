import { NextResponse } from 'next/server'
import { verificarLogin } from '@/lib/core/usuarios'
import { firmarSesion, COOKIE_SESION, SESION_DIAS } from '@/lib/sesion'
import { BASE_PATH } from '@/lib/base'

export const runtime = 'nodejs'

// Freno simple a fuerza bruta (por instancia): 1s de castigo tras fallo.
let ultimoFallo = 0

export async function POST(req: Request) {
  const { email, password } = (await req.json().catch(() => ({}))) as {
    email?: string
    password?: string
  }

  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    return NextResponse.json({ error: 'credenciales inválidas' }, { status: 401 })
  }

  if (Date.now() - ultimoFallo < 1000) {
    return NextResponse.json({ error: 'espera un segundo' }, { status: 429 })
  }

  if (!process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'credenciales inválidas' }, { status: 401 })
  }

  const resultado = await verificarLogin(email.trim(), password)

  if (!resultado) {
    ultimoFallo = Date.now()
    return NextResponse.json({ error: 'credenciales inválidas' }, { status: 401 })
  }

  const sesionPayload = {
    usuarioId: resultado.usuarioId,
    tenantId: resultado.tenantId,
    rol: resultado.rol,
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_SESION, await firmarSesion(sesionPayload, process.env.AUTH_SECRET), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: BASE_PATH,
    maxAge: SESION_DIAS * 24 * 60 * 60,
  })
  return res
}
