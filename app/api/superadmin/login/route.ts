import { NextResponse } from 'next/server'
import { verificarPassword } from '@/lib/auth'
import { firmarSuperadmin, COOKIE_SUPERADMIN, SUPERADMIN_DIAS } from '@/lib/superadmin-sesion'
import { BASE_PATH } from '@/lib/base'

export const runtime = 'nodejs'

// Freno simple antifuerza-bruta (por instancia): 1s de castigo tras fallo.
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

  const superadminEmail = process.env.SUPERADMIN_EMAIL
  const superadminHash = process.env.SUPERADMIN_PASSWORD_HASH
  const secret = process.env.SUPERADMIN_SECRET ?? process.env.AUTH_SECRET

  if (!superadminEmail || !superadminHash || !secret) {
    ultimoFallo = Date.now()
    return NextResponse.json({ error: 'credenciales inválidas' }, { status: 401 })
  }

  const emailOk = email.trim().toLowerCase() === superadminEmail.trim().toLowerCase()
  const passOk = verificarPassword(password, superadminHash)

  if (!emailOk || !passOk) {
    ultimoFallo = Date.now()
    return NextResponse.json({ error: 'credenciales inválidas' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_SUPERADMIN, await firmarSuperadmin({ email: email.trim() }, secret), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: BASE_PATH,
    maxAge: SUPERADMIN_DIAS * 24 * 60 * 60,
  })
  return res
}
