import { NextResponse } from 'next/server'
import { obtenerNegocio, guardarNegocio, type DatosNegocio } from '@/lib/core/negocio'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { requireAdmin } from '@/lib/core/autorizacion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Configuración del negocio (panel "Mi negocio"). Protegida por el middleware.
export async function GET() {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  return NextResponse.json(await obtenerNegocio(sesion.tenantId))
}

export async function PUT(req: Request) {
  const g = await requireAdmin()
  if ('error' in g) return g.error
  const datos = (await req.json().catch(() => null)) as DatosNegocio | null
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    return NextResponse.json({ error: 'objeto de datos requerido' }, { status: 400 })
  }
  await guardarNegocio(datos, g.sesion.tenantId)
  return NextResponse.json({ ok: true })
}
