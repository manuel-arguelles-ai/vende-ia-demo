import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabaseAdmin } from '@/lib/core/db'
import { scoped } from '@/lib/core/tenant'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { esquemaDelTenant, filasExport, type ProductoRow } from '@/lib/core/exportar-catalogo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function csvDoc(header: string[], filas: string[][]): string {
  const esc = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return '﻿' + [header, ...filas].map((f) => f.map(esc).join(';')).join('\n')
}

export async function GET(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  const formato = new URL(req.url).searchParams.get('formato') === 'csv' ? 'csv' : 'xlsx'

  const db = supabaseAdmin()
  const { data } = await scoped(db, sesion.tenantId)
    .from('productos')
    .select('nombre,marca,categoria,descripcion,precio,presentacion,stock,seccion,sku,tags,atributos')
    .order('nombre')
  const productos = (data ?? []) as ProductoRow[]
  const esquema = esquemaDelTenant(productos)
  const { header, filas } = filasExport(productos, esquema)

  const stamp = new Date().toISOString().slice(0, 10)
  if (formato === 'csv') {
    return new Response(csvDoc(header, filas), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="catalogo-${esquema}-${stamp}.csv"`,
      },
    })
  }
  const ws = XLSX.utils.aoa_to_sheet([header, ...filas])
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'catalogo')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return new Response(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="catalogo-${esquema}-${stamp}.xlsx"`,
    },
  })
}
