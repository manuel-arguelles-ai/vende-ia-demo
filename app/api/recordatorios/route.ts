import { NextResponse } from 'next/server'
import { crearRecordatorio, marcarRecordatorio, recordatoriosPendientes } from '@/lib/core/gestion'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { puedeVerRemitente, remitentesVisibles } from '@/lib/core/visibilidad'
import { asesorPuedeEditar } from '@/lib/core/autorizacion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Recordatorios de follow-up por lead.
export async function GET() {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  const pendientes = await recordatoriosPendientes(sesion.tenantId)
  const visibles = await remitentesVisibles(sesion)
  const resultado = visibles === null ? pendientes : pendientes.filter((r) => visibles.includes(r.remitente))
  return NextResponse.json(resultado)
}

export async function POST(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  const { remitente, cuando, nota } = (await req.json().catch(() => ({}))) as {
    remitente?: string
    cuando?: string
    nota?: string
  }
  if (!remitente || !cuando || isNaN(Date.parse(cuando))) {
    return NextResponse.json({ error: 'remitente y fecha válida requeridos' }, { status: 400 })
  }
  if (!(await puedeVerRemitente(sesion, remitente))) {
    return NextResponse.json({ error: 'sin acceso a este lead' }, { status: 403 })
  }
  if (!(await asesorPuedeEditar(sesion, 'pipeline'))) {
    return NextResponse.json({ error: 'sin permiso de edición' }, { status: 403 })
  }
  await crearRecordatorio(remitente, cuando, nota ?? null, sesion.tenantId)
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  const { id, hecho } = (await req.json().catch(() => ({}))) as { id?: number; hecho?: boolean }
  if (typeof id !== 'number' || typeof hecho !== 'boolean') {
    return NextResponse.json({ error: 'id y hecho requeridos' }, { status: 400 })
  }
  // El asesor solo puede marcar recordatorios de sus leads (visibles); admin → null (todos).
  const visibles = await remitentesVisibles(sesion)
  await marcarRecordatorio(id, hecho, sesion.tenantId, undefined, visibles)
  return NextResponse.json({ ok: true })
}
