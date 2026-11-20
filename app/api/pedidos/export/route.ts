// app/api/pedidos/export/route.ts
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { supabaseAdmin } from '@/lib/core/db'
import { scoped } from '@/lib/core/tenant'
import { remitentesVisibles } from '@/lib/core/visibilidad'

export const runtime = 'nodejs'

const COLS = ['fecha', 'producto', 'cantidad', 'estado', 'temperatura', 'score', 'remitente', 'telefono', 'zona', 'canal']
function csvCampo(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET() {
  const sesion = await tenantDeSesion()
  if (!sesion) return new Response('no autorizado', { status: 401 })

  // Visibilidad por rol: el asesor exporta solo sus leads; admin (null) todo.
  const visibles = await remitentesVisibles(sesion)
  if (visibles !== null && visibles.length === 0) {
    return new Response(COLS.join(','), { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="pedidos.csv"' } })
  }
  let q = scoped(supabaseAdmin(), sesion.tenantId)
    .from('pedidos')
    .select('created_at,producto,cantidad,estado,temperatura,score,remitente,canal,extra')
    .order('created_at', { ascending: false })
  if (visibles !== null) q = q.in('remitente', visibles)
  const { data } = await q
  const filas = ((data ?? []) as Record<string, unknown>[]).map((p) => {
    const extra = (p.extra ?? {}) as Record<string, unknown>
    return [p.created_at, p.producto, p.cantidad, p.estado, p.temperatura, p.score, p.remitente, extra.telefono, extra.zona, p.canal]
  })
  const csv = [COLS.join(','), ...filas.map((f) => f.map(csvCampo).join(','))].join('\n')
  return new Response(csv, {
    status: 200,
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="pedidos.csv"' },
  })
}
