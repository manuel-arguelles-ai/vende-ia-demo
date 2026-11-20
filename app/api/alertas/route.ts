import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/core/autorizacion'
import { alertasFraude, resolverAlerta } from '@/lib/core/alertas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const r = await requireAdmin(); if ('error' in r) return r.error
  return NextResponse.json(await alertasFraude(r.sesion.tenantId))
}

export async function PATCH(req: Request) {
  const r = await requireAdmin(); if ('error' in r) return r.error
  const { id } = (await req.json().catch(() => ({}))) as { id?: number }
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  await resolverAlerta(id, r.sesion.tenantId)
  return NextResponse.json({ ok: true })
}
