import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/db'
import { scoped } from '@/lib/core/tenant'
import { embeberQuery } from '@/lib/core/embeddings'
import { tenantDeSesion } from '@/lib/core/sesion-helper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Catálogo navegable del panel lateral. Con ?q= usa la búsqueda híbrida (sin
// cortes de honestidad: para browsear conviene ver más resultados); sin q,
// lista por sección. Protegida por el middleware.
export async function GET(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  const { tenantId } = sesion

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const db = supabaseAdmin()

  if (q) {
    const q_emb = await embeberQuery(q)
    const { data, error } = await db.rpc('buscar_productos', { q, q_emb, lim: 20, p_tenant_id: tenantId })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  const { data, error } = await scoped(db, tenantId)
    .from('productos')
    .select('nombre,marca,precio,presentacion,stock,categoria,seccion')
    .order('seccion', { ascending: true })
    .order('nombre', { ascending: true })
    .limit(40)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
