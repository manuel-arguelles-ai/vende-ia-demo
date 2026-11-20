import { NextResponse } from 'next/server'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { previsualizar } from '@/lib/core/importar-catalogo'
import { filasDeRequest } from '@/lib/core/importar-request'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  const { filas, modo } = await filasDeRequest(req)
  if (filas.length < 2) return NextResponse.json({ error: 'csv vacío' }, { status: 400 })
  return NextResponse.json(await previsualizar(filas, modo, sesion.tenantId))
}
