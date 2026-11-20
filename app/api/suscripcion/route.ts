import { NextResponse } from 'next/server'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { crearSuscripcion, type PlanPago } from '@/lib/core/billing'
import { supabaseAdmin } from '@/lib/core/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLANES_VALIDOS = new Set<PlanPago>(['pro', 'max'])

export async function POST(req: Request): Promise<Response> {
  const sesion = await tenantDeSesion()
  if (!sesion) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { plan?: unknown }
  const plan = body.plan

  if (!plan || typeof plan !== 'string' || !PLANES_VALIDOS.has(plan as PlanPago)) {
    return NextResponse.json({ error: 'plan inválido. Valores aceptados: pro, max' }, { status: 400 })
  }

  // Obtener el email del usuario desde la tabla usuarios
  const db = supabaseAdmin()
  const { data: usuario } = await db
    .from('usuarios')
    .select('email')
    .eq('id', sesion.usuarioId)
    .single()

  const email: string = (usuario as { email?: string } | null)?.email ?? `usuario-${sesion.usuarioId}@vende-ia.local`

  const { init_point } = await crearSuscripcion(sesion.tenantId, plan as PlanPago, email)

  return NextResponse.json({ init_point })
}
