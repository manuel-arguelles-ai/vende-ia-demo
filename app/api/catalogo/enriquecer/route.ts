import { NextResponse } from 'next/server'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { asesorPuedeEditar } from '@/lib/core/autorizacion'
import { resumenEnriquecer, enriquecer } from '@/lib/core/enriquecer-catalogo'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  if (!(await asesorPuedeEditar(sesion, 'catalogo'))) {
    return NextResponse.json({ error: 'sin permiso de edición' }, { status: 403 })
  }
  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean }
  if (body.dryRun) return NextResponse.json(await resumenEnriquecer(sesion.tenantId))
  return NextResponse.json(await enriquecer(sesion.tenantId))
}
