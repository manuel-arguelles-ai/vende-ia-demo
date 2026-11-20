import { NextResponse } from 'next/server'
import { crearTenantConAdmin } from '@/lib/core/usuarios'
import { firmarSesion, COOKIE_SESION, SESION_DIAS } from '@/lib/sesion'
import { BASE_PATH } from '@/lib/base'

export const runtime = 'nodejs'

// Ping best-effort al operador por WhatsApp (vía worker /notificar-admin).
// Fail-open total: si no hay worker configurado o algo falla, el alta no se ve afectada.
async function pingNuevoInquilino(nombre: string, rubro: string, email: string): Promise<void> {
  const url = process.env.WORKER_URL
  const token = process.env.WORKER_TOKEN
  if (!url) return
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2500)
    await fetch(`${url.replace(/\/$/, '')}/notificar-admin`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ texto: `🆕 Nuevo inquilino: ${nombre} (${rubro}) — ${email}` }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t))
  } catch {
    /* fail-open */
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const { nombre, rubro, email, password } = body

  // Validar que todos los campos estén presentes y sean strings no vacíos
  if (
    typeof nombre !== 'string' || !nombre.trim() ||
    typeof rubro !== 'string' || !rubro.trim() ||
    typeof email !== 'string' || !email.trim() ||
    typeof password !== 'string' || !password.trim()
  ) {
    return NextResponse.json({ error: 'campos requeridos: nombre, rubro, email, password' }, { status: 400 })
  }

  try {
    const r = await crearTenantConAdmin({ nombre, rubro, email, password })

    // Avisar al operador (best-effort, no bloquea ni rompe el alta).
    await pingNuevoInquilino(nombre, rubro, email)

    const token = await firmarSesion(
      { usuarioId: r.usuarioId, tenantId: r.tenantId, rol: 'admin' },
      process.env.AUTH_SECRET,
    )

    const res = NextResponse.json({ widget_key: r.widgetKey })
    res.cookies.set(COOKIE_SESION, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: BASE_PATH,
      maxAge: SESION_DIAS * 24 * 60 * 60,
    })
    return res
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('EMAIL_DUPLICATE') || msg.toLowerCase().includes('email')) {
      return NextResponse.json({ error: 'email ya registrado' }, { status: 409 })
    }
    console.error('[registro] error inesperado:', msg)
    return NextResponse.json({ error: 'error interno' }, { status: 500 })
  }
}
