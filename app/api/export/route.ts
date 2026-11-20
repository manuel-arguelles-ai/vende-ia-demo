import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/db'
import { scoped } from '@/lib/core/tenant'
import { jidANumero, telefonoMostrado } from '@/lib/core/handoff'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { remitentesVisibles } from '@/lib/core/visibilidad'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Export CSV de contactos o pedidos (Excel-friendly, UTF-8 con BOM).
function csv(filas: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + filas.map((f) => f.map(esc).join(';')).join('\n')
}

export async function GET(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  const { tenantId } = sesion

  const tipo = new URL(req.url).searchParams.get('tipo') ?? 'contactos'
  const db = supabaseAdmin()
  const s = scoped(db, tenantId)

  // Visibilidad por rol: el asesor exporta solo sus leads; admin (null) todo.
  const visibles = await remitentesVisibles(sesion, db)
  if (visibles !== null && visibles.length === 0) {
    return new Response('﻿', { headers: { 'content-type': 'text/csv; charset=utf-8' } })
  }

  let contenido: string
  if (tipo === 'pedidos') {
    let q = s
      .from('pedidos')
      .select('created_at,remitente,extra,canal,mensaje_crudo,producto,cantidad,temperatura,score,derivar,estado')
      .order('created_at', { ascending: false })
      .limit(2000)
    if (visibles !== null) q = q.in('remitente', visibles)
    const { data } = await q
    contenido = csv([
      ['fecha', 'cliente', 'canal', 'mensaje', 'producto', 'cantidad', 'temperatura', 'score', 'derivado', 'estado'],
      ...((data ?? []) as Array<Record<string, unknown>>).map((p) => [
        p.created_at as string, telefonoMostrado(p.remitente as string, p.extra as Record<string, unknown>), p.canal as string, p.mensaje_crudo as string,
        p.producto as string, p.cantidad as number, p.temperatura as string, p.score as number,
        p.derivar ? 'sí' : 'no', p.estado as string,
      ]),
    ])
  } else {
    let q = s.from('contactos').select('*').order('actualizado', { ascending: false })
    if (visibles !== null) q = q.in('remitente', visibles)
    const { data } = await q
    contenido = csv([
      ['nombre', 'telefono', 'ciudad', 'productos_de_interes', 'actualizado'],
      ...((data ?? []) as Array<Record<string, unknown>>).map((c) => [
        c.nombre as string, jidANumero((c.telefono ?? c.remitente) as string),
        c.ciudad as string, ((c.productos as string[]) ?? []).join(', '), c.actualizado as string,
      ]),
    ])
  }

  return new Response(contenido, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="vende-ia-${tipo}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
