import { NextResponse } from 'next/server'
import { sesionSuperadmin } from '@/lib/superadmin-route'
import { metricasTenants, actualizarTenant } from '@/lib/core/plataforma'
import { crearTenantConAdmin } from '@/lib/core/usuarios'
import { saludCanales, resumenPlataforma } from '@/lib/core/monitoreo'
import { eventosRecientes } from '@/lib/core/eventos'

export const runtime = 'nodejs'

// ─── GET /api/superadmin/tenants ─────────────────────────────────────────────

export async function GET() {
  if (!(await sesionSuperadmin())) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  }

  const salud = await saludCanales()
  const tenants = await metricasTenants(undefined, salud)
  const resumen = resumenPlataforma(tenants, salud)
  const eventos = await eventosRecientes(20)
  return NextResponse.json({ tenants, resumen, eventos })
}

// ─── POST /api/superadmin/tenants ────────────────────────────────────────────

export async function POST(req: Request) {
  if (!(await sesionSuperadmin())) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    nombre?: string
    rubro?: string
    email?: string
    password?: string
  }

  const { nombre, rubro, email, password } = body

  if (!nombre || !rubro || !email || !password) {
    return NextResponse.json({ error: 'faltan campos requeridos' }, { status: 400 })
  }

  try {
    const result = await crearTenantConAdmin({ nombre, rubro, email, password })
    return NextResponse.json({ tenantId: result.tenantId, widgetKey: result.widgetKey })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('EMAIL_DUPLICATE')) {
      return NextResponse.json({ error: 'email ya registrado' }, { status: 409 })
    }
    throw err
  }
}

// ─── PATCH /api/superadmin/tenants ───────────────────────────────────────────

export async function PATCH(req: Request) {
  if (!(await sesionSuperadmin())) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    id?: number
    estado?: string
    plan?: string
    ventana_turnos?: number | null
  }

  if (body.id === undefined || body.id === null) {
    return NextResponse.json({ error: 'falta id' }, { status: 400 })
  }

  await actualizarTenant(body.id, { estado: body.estado, plan: body.plan, ventana_turnos: body.ventana_turnos })
  return NextResponse.json({ ok: true })
}
