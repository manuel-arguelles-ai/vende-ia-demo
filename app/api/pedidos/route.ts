import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/db'
import { scoped } from '@/lib/core/tenant'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { remitentesVisibles } from '@/lib/core/visibilidad'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  const { tenantId } = sesion

  const visibles = await remitentesVisibles(sesion)
  if (visibles !== null && visibles.length === 0) return NextResponse.json([])

  let q = scoped(supabaseAdmin(), tenantId)
    .from('pedidos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (visibles !== null) q = q.in('remitente', visibles)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
