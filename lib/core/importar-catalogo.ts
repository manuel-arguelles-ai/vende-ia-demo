import { supabaseAdmin } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scoped } from './tenant'
import { embeberDocumento } from './embeddings'

export type Modo = 'actualizar' | 'reemplazar'
export type Formato = 'libros' | 'generico'

export type FilaProducto = {
  nombre: string
  precio: number
  stock: number
  descripcion?: string
  marca?: string
  categoria?: string
  presentacion?: string
  seccion?: string
  sku?: string
  tags?: string[]
  atributos?: Record<string, unknown>
}

export type ResumenImport = {
  formato: Formato
  modo: Modo
  total: number
  validas: number
  invalidas: number
  duplicadosSku: number
  aActualizar: number
  aAgregar: number
  sinDescripcion: number
  sinGenero: number
}

const CAP_FILAS = 5000

// ─── Parser CSV (movido desde la route; comportamiento idéntico) ───────────────
export function parsearCSV(texto: string, sep: string = ','): string[][] {
  const filas: string[][] = []
  let fila: string[] = []
  let campo = ''
  let enComillas = false
  let i = 0
  while (i < texto.length) {
    const ch = texto[i]
    if (enComillas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i += 2 } else { enComillas = false; i++ }
      } else { campo += ch; i++ }
    } else {
      if (ch === '"') { enComillas = true; i++ }
      else if (ch === sep) { fila.push(campo); campo = ''; i++ }
      else if (ch === '\r') { fila.push(campo); campo = ''; filas.push(fila); fila = []; if (texto[i + 1] === '\n') i++; i++ }
      else if (ch === '\n') { fila.push(campo); campo = ''; filas.push(fila); fila = []; i++ }
      else { campo += ch; i++ }
    }
  }
  if (campo || fila.length > 0) { fila.push(campo); filas.push(fila) }
  return filas.filter((f) => f.some((c) => c.trim() !== ''))
}

export function detectarFormato(header: string[]): Formato {
  const h = header.map((c) => c.trim().toLowerCase())
  return h.includes('isbn') && h.includes('titulo') ? 'libros' : 'generico'
}

function idxDe(header: string[]): Record<string, number> {
  return Object.fromEntries(header.map((h, i) => [h.trim().toLowerCase(), i]))
}
const val = (row: string[], idx: Record<string, number>, col: string): string =>
  idx[col] != null ? (row[idx[col]] ?? '').trim() : ''
const num = (s: string): number => parseInt(s, 10) || 0

// Decimal con punto o coma (Excel ES-PE exporta coma). "49,50"→49.5, "49.50"→49.5
export function parseDecimal(s: string): number {
  const t = s.trim()
  if (t === '') return NaN
  return parseFloat(t.includes('.') ? t : t.replace(',', '.'))
}

export function mapearFila(row: string[], idx: Record<string, number>, formato: Formato): FilaProducto | null {
  if (formato === 'libros') {
    const nombre = val(row, idx, 'titulo')
    if (!nombre) return null
    const precio = parseDecimal(val(row, idx, 'precio_soles'))
    if (isNaN(precio)) return null
    const central = num(val(row, idx, 'stock_central'))
    const miraflores = num(val(row, idx, 'stock_miraflores'))
    const sanisidro = num(val(row, idx, 'stock_sanisidro'))
    const totalCsv = val(row, idx, 'stock_total')
    const stock = totalCsv ? num(totalCsv) : central + miraflores + sanisidro
    const autor = val(row, idx, 'autor')
    const genero = val(row, idx, 'genero')
    const descBase = val(row, idx, 'descripcion')
    const descripcion = `${descBase ? descBase + ' ' : ''}Stock por tienda: Central ${central}, Miraflores ${miraflores}, San Isidro ${sanisidro}.`.trim()
    const f: FilaProducto = { nombre, precio, stock, descripcion }
    const editorial = val(row, idx, 'editorial')
    if (editorial) f.marca = editorial
    const sku = val(row, idx, 'isbn')
    if (sku) f.sku = sku
    if (genero) f.tags = [genero]
    const atributos: Record<string, unknown> = { stock_por_tienda: { central, miraflores, sanisidro } }
    if (autor) atributos.autor = autor
    const edicion = val(row, idx, 'edicion'); if (edicion) atributos.edicion = edicion
    const anio = val(row, idx, 'anio'); if (anio) atributos.anio = anio
    f.atributos = atributos
    return f
  }
  // genérico
  const nombre = val(row, idx, 'nombre')
  if (!nombre) return null
  const precio = parseDecimal(val(row, idx, 'precio'))
  if (isNaN(precio)) return null
  const f: FilaProducto = { nombre, precio, stock: num(val(row, idx, 'stock')) }
  const desc = val(row, idx, 'descripcion'); if (desc) f.descripcion = desc
  const cat = val(row, idx, 'categoria'); if (cat) f.categoria = cat
  const marca = val(row, idx, 'marca'); if (marca) f.marca = marca
  const pres = val(row, idx, 'presentacion'); if (pres) f.presentacion = pres
  const sec = val(row, idx, 'seccion'); if (sec) f.seccion = sec
  const sku = val(row, idx, 'sku'); if (sku) f.sku = sku
  const tags = val(row, idx, 'tags'); if (tags) f.tags = tags.split(',').map((t) => t.trim()).filter(Boolean)
  return f
}

export function textoEmbed(f: FilaProducto, formato: Formato): string {
  if (formato === 'libros') {
    const autor = (f.atributos?.autor as string) ?? ''
    const genero = (f.tags ?? []).join(' ')
    return [f.nombre, autor, f.marca, genero, f.descripcion].filter(Boolean).join(' ')
  }
  return [f.nombre, f.marca, f.categoria, f.descripcion].filter(Boolean).join(' ')
}

function deduplicarPorSku(filas: FilaProducto[]): { deduped: FilaProducto[]; duplicadosSku: number } {
  // Last-wins: for rows with a non-null sku, keep the last occurrence
  const skuMap = new Map<string, number>() // sku → index in result
  const deduped: FilaProducto[] = []
  let duplicadosSku = 0
  for (const f of filas) {
    if (f.sku) {
      if (skuMap.has(f.sku)) {
        // Replace the earlier occurrence with this one (last-wins)
        deduped[skuMap.get(f.sku)!] = f
        duplicadosSku++
      } else {
        skuMap.set(f.sku, deduped.length)
        deduped.push(f)
      }
    } else {
      deduped.push(f)
    }
  }
  return { deduped, duplicadosSku }
}

function preparar(filas: string[][], formatoForzado?: Formato) {
  const header = filas[0]
  const formato = formatoForzado ?? detectarFormato(header)
  const idx = idxDe(header)
  let datos = filas.slice(1)
  const recortadas = datos.length > CAP_FILAS
  if (recortadas) datos = datos.slice(0, CAP_FILAS)
  const mapped: FilaProducto[] = []
  let invalidas = 0
  for (const row of datos) {
    const f = mapearFila(row, idx, formato)
    if (f) mapped.push(f); else invalidas++
  }
  const { deduped: validas, duplicadosSku } = deduplicarPorSku(mapped)
  return { formato, validas, invalidas, duplicadosSku, recortadas }
}

export async function previsualizar(
  filas: string[][], modo: Modo, tenantId: number, db: SupabaseClient = supabaseAdmin(), formatoForzado?: Formato,
): Promise<ResumenImport> {
  const { formato, validas, invalidas, duplicadosSku } = preparar(filas, formatoForzado)
  const { data } = await scoped(db, tenantId).from('productos').select('sku')
  const existentes = new Set(((data ?? []) as { sku: string | null }[]).map((r) => r.sku).filter(Boolean) as string[])
  let aActualizar = 0, aAgregar = 0, sinDescripcion = 0, sinGenero = 0
  for (const f of validas) {
    if (modo === 'actualizar' && f.sku && existentes.has(f.sku)) aActualizar++; else aAgregar++
    if (!f.descripcion) sinDescripcion++
    if (!f.tags || f.tags.length === 0) sinGenero++
  }
  return { formato, modo, total: validas.length + invalidas + duplicadosSku, validas: validas.length, invalidas, duplicadosSku, aActualizar, aAgregar, sinDescripcion, sinGenero }
}

export async function importar(
  filas: string[][], modo: Modo, tenantId: number,
  db: SupabaseClient = supabaseAdmin(),
  embed: (t: string) => Promise<number[] | null> = embeberDocumento,
  formatoForzado?: Formato,
): Promise<{ importados: number; actualizados: number; omitidas: number; recortadas?: boolean }> {
  const { formato, validas, invalidas, recortadas } = preparar(filas, formatoForzado)
  // embeddings secuenciales
  const conEmbed: Array<FilaProducto & { embedding?: number[] }> = []
  for (const f of validas) {
    const e = await embed(textoEmbed(f, formato))
    conEmbed.push(Array.isArray(e) ? { ...f, embedding: e } : { ...f })
  }
  if (modo === 'reemplazar') {
    // Transactional delete+insert via RPC to prevent empty catalog on failure
    const filasPg = conEmbed.map((f) => ({
      nombre: f.nombre,
      marca: f.marca ?? null,
      categoria: f.categoria ?? null,
      descripcion: f.descripcion ?? null,
      precio: f.precio,
      presentacion: f.presentacion ?? null,
      stock: f.stock,
      sku: f.sku ?? null,
      tags: f.tags ?? null,
      atributos: f.atributos ?? null,
      embedding: f.embedding ?? null,
    }))
    const { error } = await db.rpc('reemplazar_catalogo', { p_tenant_id: tenantId, p_filas: filasPg })
    if (error) throw new Error(error.message)
    return { importados: conEmbed.length, actualizados: 0, omitidas: invalidas, ...(recortadas ? { recortadas } : {}) }
  }
  // actualizar: upsert los que tienen sku, insert los que no (dedup ensures no duplicate skus in batch)
  const s = scoped(db, tenantId)
  const conSku = conEmbed.filter((f) => f.sku)
  const sinSku = conEmbed.filter((f) => !f.sku)
  let actualizados = 0, importados = 0
  if (conSku.length) {
    const { error } = await s.from('productos').upsert(conSku as unknown as Record<string, unknown>[], { onConflict: 'tenant_id,sku' })
    if (error) throw new Error(error.message)
    actualizados += conSku.length
  }
  if (sinSku.length) {
    const { error } = await s.from('productos').insert(sinSku as unknown as Record<string, unknown>[])
    if (error) throw new Error(error.message)
    importados += sinSku.length
  }
  return { importados, actualizados, omitidas: invalidas, ...(recortadas ? { recortadas } : {}) }
}
