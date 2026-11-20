import { NextResponse } from 'next/server'
import { setBotPausado } from '@/lib/core/control'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { puedeVerRemitente } from '@/lib/core/visibilidad'
import { asesorPuedeEditar } from '@/lib/core/autorizacion'

export const runtime = 'nodejs'

// Toggle del takeover: pausar a Nina para un lead, o devolverle la conversación.
// Protegida por el middleware de sesión.
export async function POST(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  const { remitente, pausado } = (await req.json().catch(() => ({}))) as {
    remitente?: string
    pausado?: boolean
  }
  if (!remitente || typeof remitente !== 'string' || typeof pausado !== 'boolean') {
    return NextResponse.json({ error: 'remitente y pausado requeridos' }, { status: 400 })
  }
  if (!(await puedeVerRemitente(sesion, remitente))) {
    return NextResponse.json({ error: 'sin acceso a este lead' }, { status: 403 })
  }
  if (!(await asesorPuedeEditar(sesion, 'pipeline'))) {
    return NextResponse.json({ error: 'sin permiso de edición' }, { status: 403 })
  }
  await setBotPausado(remitente, pausado, sesion.tenantId)
  return NextResponse.json({ ok: true })
}
