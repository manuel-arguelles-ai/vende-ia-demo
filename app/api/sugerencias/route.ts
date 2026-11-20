import { NextResponse } from 'next/server'
import { cargarHistorial } from '@/lib/core/historial'
import { ultimoPedido } from '@/lib/core/db'
import { obtenerNegocio } from '@/lib/core/negocio'
import { sugerirRespuestas } from '@/lib/core/sugerir'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { puedeVerRemitente } from '@/lib/core/visibilidad'

export const runtime = 'nodejs'

// Borradores IA para el asesor (rellenan el composer, no se envían solos).
// Protegida por el middleware.
export async function POST(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  const { remitente } = (await req.json().catch(() => ({}))) as { remitente?: string }
  if (!remitente) return NextResponse.json({ error: 'remitente requerido' }, { status: 400 })
  if (!(await puedeVerRemitente(sesion, remitente))) {
    return NextResponse.json({ error: 'sin acceso a este lead' }, { status: 403 })
  }

  try {
    const [historial, pedido, negocio] = await Promise.all([
      cargarHistorial(remitente, sesion.tenantId),
      ultimoPedido(remitente, sesion.tenantId),
      obtenerNegocio(sesion.tenantId),
    ])
    const r = await sugerirRespuestas({ historial, negocio, producto: pedido?.producto ?? null })
    return NextResponse.json(r)
  } catch (err) {
    console.error('sugerencias error', err)
    return NextResponse.json({ error: 'no se pudieron generar sugerencias' }, { status: 500 })
  }
}
