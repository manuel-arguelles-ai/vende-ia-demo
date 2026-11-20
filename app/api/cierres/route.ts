import { NextResponse } from 'next/server'
import { registrarCierre } from '@/lib/core/gestion'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { puedeVerRemitente } from '@/lib/core/visibilidad'
import { asesorPuedeEditar } from '@/lib/core/autorizacion'

export const runtime = 'nodejs'

// Cierre del ciclo de venta desde el chat: ganado (con monto), perdido o reabierto.
export async function POST(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  const { remitente, estado, monto, motivo, tipo, tiendaId } = (await req.json().catch(() => ({}))) as {
    remitente?: string
    estado?: 'ganado' | 'perdido' | 'reabierto' | 'reservada'
    monto?: number
    motivo?: string
    tipo?: 'venta' | 'reserva'
    tiendaId?: number
  }
  if (!remitente || !estado || !['ganado', 'perdido', 'reabierto', 'reservada'].includes(estado)) {
    return NextResponse.json({ error: 'remitente y estado válidos requeridos' }, { status: 400 })
  }
  if (!(await puedeVerRemitente(sesion, remitente))) {
    return NextResponse.json({ error: 'sin acceso a este lead' }, { status: 403 })
  }
  if (!(await asesorPuedeEditar(sesion, 'pipeline'))) {
    return NextResponse.json({ error: 'sin permiso de edición' }, { status: 403 })
  }
  await registrarCierre(remitente, estado, typeof monto === 'number' ? monto : null, motivo ?? null, sesion.tenantId, undefined, {
    tipo: tipo ?? undefined,
    tiendaId: typeof tiendaId === 'number' ? tiendaId : undefined,
  })
  return NextResponse.json({ ok: true })
}
