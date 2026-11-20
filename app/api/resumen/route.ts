import { NextResponse } from 'next/server'
import { cargarHistorial } from '@/lib/core/historial'
import { resumirConversacion } from '@/lib/core/resumir'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { puedeVerRemitente } from '@/lib/core/visibilidad'

export const runtime = 'nodejs'

// Resumen IA de la conversación: contexto en 5 segundos antes del takeover.
export async function POST(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  const { remitente } = (await req.json().catch(() => ({}))) as { remitente?: string }
  if (!remitente) return NextResponse.json({ error: 'remitente requerido' }, { status: 400 })
  if (!(await puedeVerRemitente(sesion, remitente))) {
    return NextResponse.json({ error: 'sin acceso a este lead' }, { status: 403 })
  }
  try {
    const historial = await cargarHistorial(remitente, sesion.tenantId, undefined, 40)
    return NextResponse.json(await resumirConversacion(historial))
  } catch (err) {
    console.error('resumen error', err)
    return NextResponse.json({ error: 'no se pudo resumir' }, { status: 500 })
  }
}
