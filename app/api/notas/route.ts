import { NextResponse } from 'next/server'
import { agregarNota, listarNotas } from '@/lib/core/gestion'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { puedeVerRemitente } from '@/lib/core/visibilidad'
import { asesorPuedeEditar } from '@/lib/core/autorizacion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Notas internas del asesor (solo visibles en el CRM).
export async function GET(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  const remitente = new URL(req.url).searchParams.get('remitente')
  if (!remitente) return NextResponse.json({ error: 'remitente requerido' }, { status: 400 })
  if (!(await puedeVerRemitente(sesion, remitente))) {
    return NextResponse.json({ error: 'sin acceso a este lead' }, { status: 403 })
  }
  return NextResponse.json(await listarNotas(remitente, sesion.tenantId))
}

export async function POST(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  const { remitente, texto } = (await req.json().catch(() => ({}))) as { remitente?: string; texto?: string }
  if (!remitente || !texto?.trim()) {
    return NextResponse.json({ error: 'remitente y texto requeridos' }, { status: 400 })
  }
  if (!(await puedeVerRemitente(sesion, remitente))) {
    return NextResponse.json({ error: 'sin acceso a este lead' }, { status: 403 })
  }
  if (!(await asesorPuedeEditar(sesion, 'pipeline'))) {
    return NextResponse.json({ error: 'sin permiso de edición' }, { status: 403 })
  }
  await agregarNota(remitente, texto, sesion.tenantId)
  return NextResponse.json({ ok: true })
}
