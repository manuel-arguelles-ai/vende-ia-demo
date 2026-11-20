import { NextResponse, type NextRequest } from 'next/server'
import { sesionValida, COOKIE_SESION } from './lib/sesion'
import { superadminValido, COOKIE_SUPERADMIN } from './lib/superadmin-sesion'
import { conBase } from './lib/base'

// Protege todo el CRM detrás del login.
// Públicas: login, registro (onboarding), widget/chat (llamada pública del widget).
const PUBLICAS = new Set([
  '/login',
  '/api/login',
  '/registro',
  '/api/registro',
  '/api/widget/chat',
  '/api/mp/webhook',
  '/widget.js',
])

export async function middleware(req: NextRequest) {
  // nextUrl.pathname viene sin el basePath (Next lo separa solo).
  const ruta = req.nextUrl.pathname

  // ── Gate super-admin (ANTES del gate de tenant) ──────────────────────────
  // Rutas públicas del super-admin: no requieren sesión.
  if (ruta === '/superadmin/login' || ruta === '/api/superadmin/login') {
    return NextResponse.next()
  }
  // Rutas protegidas del super-admin.
  if (ruta.startsWith('/superadmin') || ruta.startsWith('/api/superadmin')) {
    const saSecret = process.env.SUPERADMIN_SECRET ?? process.env.AUTH_SECRET ?? ''
    const saToken = req.cookies.get(COOKIE_SUPERADMIN)?.value
    if (await superadminValido(saToken, saSecret)) return NextResponse.next()
    if (ruta.startsWith('/api/')) {
      return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
    }
    return NextResponse.redirect(new URL(conBase('/superadmin/login'), req.url))
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Gate de tenant (sin cambios).
  if (PUBLICAS.has(ruta)) return NextResponse.next()

  const token = req.cookies.get(COOKIE_SESION)?.value
  if (await sesionValida(token, process.env.AUTH_SECRET ?? '')) return NextResponse.next()

  if (ruta.startsWith('/api/')) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  }
  return NextResponse.redirect(new URL(conBase('/login'), req.url))
}

export const config = {
  // Todo menos los assets estáticos de Next y los adjuntos demo (vouchers).
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|demo/).*)'],
}
