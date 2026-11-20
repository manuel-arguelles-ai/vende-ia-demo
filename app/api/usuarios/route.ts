import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/core/autorizacion'
import { crearAsesor, listarUsuarios, actualizarUsuario } from '@/lib/core/usuarios'
import { obtenerTenantPlan } from '@/lib/core/plataforma'
import { puedeAgregarAsesor } from '@/lib/core/limites'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await requireAdmin()
  if ('error' in g) return g.error
  return NextResponse.json(await listarUsuarios(g.sesion.tenantId))
}

export async function POST(req: Request) {
  const g = await requireAdmin()
  if ('error' in g) return g.error
  const b = (await req.json().catch(() => ({}))) as { nombre?: string; email?: string; password?: string }
  if (!b.nombre || !b.email || !b.password) return NextResponse.json({ error: 'nombre, email y password requeridos' }, { status: 400 })
  const { plan } = await obtenerTenantPlan(g.sesion.tenantId)
  if (!(await puedeAgregarAsesor(g.sesion.tenantId, plan))) {
    return NextResponse.json({ error: 'límite de asesores del plan alcanzado' }, { status: 403 })
  }
  try {
    return NextResponse.json(await crearAsesor({ nombre: b.nombre, email: b.email, password: b.password }, g.sesion.tenantId))
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('EMAIL_DUPLICATE')) return NextResponse.json({ error: 'email ya registrado' }, { status: 409 })
    return NextResponse.json({ error: 'error al crear asesor' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const g = await requireAdmin()
  if ('error' in g) return g.error
  const b = (await req.json().catch(() => ({}))) as { id?: number; nombre?: string; activo?: boolean; peso?: number; limite_activos?: number | null }
  if (typeof b.id !== 'number') return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  if (b.peso !== undefined && (typeof b.peso !== 'number' || !Number.isInteger(b.peso) || b.peso < 1)) {
    return NextResponse.json({ error: 'peso debe ser un entero positivo' }, { status: 400 })
  }
  if (b.limite_activos !== undefined && b.limite_activos !== null && (typeof b.limite_activos !== 'number' || !Number.isInteger(b.limite_activos) || b.limite_activos < 0)) {
    return NextResponse.json({ error: 'limite_activos debe ser un entero no negativo o null' }, { status: 400 })
  }
  const cambios: { nombre?: string; activo?: boolean; peso?: number; limite_activos?: number | null } = {}
  if (b.nombre !== undefined) cambios.nombre = b.nombre
  if (b.activo !== undefined) cambios.activo = b.activo
  if (b.peso !== undefined) cambios.peso = b.peso
  if (b.limite_activos !== undefined) cambios.limite_activos = b.limite_activos
  await actualizarUsuario(b.id, cambios, g.sesion.tenantId)
  return NextResponse.json({ ok: true })
}
