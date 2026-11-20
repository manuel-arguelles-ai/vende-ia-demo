import { NextResponse } from 'next/server'
import { sesionSuperadmin } from '@/lib/superadmin-route'
import { detalleTenant } from '@/lib/core/superadmin-detalle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Ficha de detalle de un inquilino (soporte del super-admin): config + actividad.
export async function GET(req: Request) {
  if (!(await sesionSuperadmin())) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  }
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!id || !Number.isInteger(id)) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  }
  return NextResponse.json(await detalleTenant(id))
}
