import { NextResponse } from 'next/server'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { requireAdmin } from '@/lib/core/autorizacion'
import { listarTiendas, crearTienda, actualizarTienda, eliminarTienda } from '@/lib/core/tiendas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  return NextResponse.json(await listarTiendas(sesion.tenantId))
}

export async function POST(req: Request) {
  const r = await requireAdmin(); if ('error' in r) return r.error
  const b = (await req.json().catch(() => ({}))) as { nombre?: string; direccion?: string; distrito?: string; horario?: string }
  if (!b.nombre || !b.nombre.trim()) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  await crearTienda({ tenantId: r.sesion.tenantId, nombre: b.nombre.trim(), direccion: b.direccion, distrito: b.distrito, horario: b.horario })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  const r = await requireAdmin(); if ('error' in r) return r.error
  const b = (await req.json().catch(() => ({}))) as { id?: number; nombre?: string; direccion?: string; distrito?: string; horario?: string; activa?: boolean }
  if (!b.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const { id, ...campos } = b
  await actualizarTienda(id, r.sesion.tenantId, campos)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const r = await requireAdmin(); if ('error' in r) return r.error
  const { id } = (await req.json().catch(() => ({}))) as { id?: number }
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  await eliminarTienda(id, r.sesion.tenantId)
  return NextResponse.json({ ok: true })
}
