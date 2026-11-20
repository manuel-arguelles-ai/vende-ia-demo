import { NextResponse } from 'next/server'
import { atender } from '@/lib/core/atender'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { puedeVerRemitente } from '@/lib/core/visibilidad'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  }

  try {
    const { mensaje, remitente } = await req.json()
    if (!mensaje || typeof mensaje !== 'string') {
      return NextResponse.json({ error: 'mensaje requerido' }, { status: 400 })
    }
    const rem = typeof remitente === 'string' && remitente ? remitente : 'demo'
    // El simulador usa 'demo' (sandbox, abierto a todos); si apunta a un lead real,
    // exigir que el asesor tenga acceso a ese remitente.
    if (rem !== 'demo' && !(await puedeVerRemitente(sesion, rem))) {
      return NextResponse.json({ error: 'sin acceso a este lead' }, { status: 403 })
    }
    const r = await atender({
      mensaje,
      canal: 'simulador',
      remitente: rem,
      tenantId: sesion.tenantId,
    })
    return NextResponse.json(r)
  } catch (err) {
    console.error('atender error', err)
    return NextResponse.json({ error: 'no se pudo procesar' }, { status: 500 })
  }
}
