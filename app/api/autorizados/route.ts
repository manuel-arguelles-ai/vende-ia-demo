import { NextResponse } from 'next/server'
import { listarAutorizados, agregarAutorizado, quitarAutorizado } from '@/lib/core/allowlist'
import { tenantDeSesion } from '@/lib/core/sesion-helper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  return NextResponse.json(await listarAutorizados(sesion.tenantId))
}

export async function POST(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })

  const { numero, etiqueta } = (await req.json().catch(() => ({}))) as {
    numero?: unknown
    etiqueta?: string
  }
  if (!numero || typeof numero !== 'string') {
    return NextResponse.json({ error: 'numero requerido' }, { status: 400 })
  }

  await agregarAutorizado(numero, etiqueta ?? null, sesion.tenantId)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })

  const { numero } = (await req.json().catch(() => ({}))) as { numero?: string }
  if (!numero) return NextResponse.json({ error: 'numero requerido' }, { status: 400 })

  await quitarAutorizado(numero, sesion.tenantId)
  return NextResponse.json({ ok: true })
}
