import { NextResponse } from 'next/server'
import { sesionSuperadmin } from '@/lib/superadmin-route'
import { firmarSesion, COOKIE_SESION, SESION_DIAS } from '@/lib/sesion'
import { BASE_PATH } from '@/lib/base'

export const runtime = 'nodejs'

// ─── POST /api/superadmin/impersonar ─────────────────────────────────────────

export async function POST(req: Request) {
  if (!(await sesionSuperadmin())) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { tenantId?: number }

  if (body.tenantId === undefined || body.tenantId === null) {
    return NextResponse.json({ error: 'falta tenantId' }, { status: 400 })
  }

  const secret = process.env.AUTH_SECRET ?? ''
  const token = await firmarSesion({ usuarioId: 0, tenantId: body.tenantId, rol: 'admin' }, secret)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: BASE_PATH,
    maxAge: SESION_DIAS * 24 * 60 * 60,
  })
  return res
}
