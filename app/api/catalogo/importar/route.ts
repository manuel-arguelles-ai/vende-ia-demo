import { NextResponse } from 'next/server'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { asesorPuedeEditar } from '@/lib/core/autorizacion'
import { importar } from '@/lib/core/importar-catalogo'
import { filasDeRequest } from '@/lib/core/importar-request'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autenticado' }, { status: 401 })
  if (!(await asesorPuedeEditar(sesion, 'catalogo'))) {
    return NextResponse.json({ error: 'sin permiso de edición' }, { status: 403 })
  }
  const { filas, modo } = await filasDeRequest(req)
  if (filas.length < 2) return NextResponse.json({ importados: 0, actualizados: 0, omitidas: 0 })
  try {
    return NextResponse.json(await importar(filas, modo, sesion.tenantId))
  } catch (e) {
    console.error('[catalogo/importar]', e)
    return NextResponse.json({ error: 'error al importar' }, { status: 500 })
  }
}
