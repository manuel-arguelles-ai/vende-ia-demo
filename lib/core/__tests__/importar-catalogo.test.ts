import { describe, it, expect } from 'vitest'
import { detectarFormato, mapearFila, textoEmbed, previsualizar, importar, type FilaProducto } from '../importar-catalogo'
import type { SupabaseClient } from '@supabase/supabase-js'

const idxDe = (header: string[]) => Object.fromEntries(header.map((h, i) => [h.trim().toLowerCase(), i]))

describe('detectarFormato', () => {
  it('libros si hay isbn + titulo', () => {
    expect(detectarFormato(['isbn', 'titulo', 'precio_soles'])).toBe('libros')
    expect(detectarFormato(['nombre', 'precio', 'stock'])).toBe('generico')
  })
})

describe('mapearFila — libros', () => {
  const header = ['isbn','titulo','autor','editorial','edicion','anio','precio_soles','stock_central','stock_miraflores','stock_sanisidro','stock_total','genero','descripcion']
  const idx = idxDe(header)
  it('mapea isbn→sku, titulo→nombre, stock por tienda→atributos + descripcion compuesta', () => {
    const row = ['978-1','El Proceso','Kafka','Tusquets','1','1925','50','2','0','1','3','novela','Clásico sobre la culpa']
    const f = mapearFila(row, idx, 'libros') as FilaProducto
    expect(f.sku).toBe('978-1')
    expect(f.nombre).toBe('El Proceso')
    expect(f.precio).toBe(50)
    expect(f.stock).toBe(3)
    expect(f.marca).toBe('Tusquets')
    expect(f.atributos).toMatchObject({ autor: 'Kafka', stock_por_tienda: { central: 2, miraflores: 0, sanisidro: 1 } })
    expect(f.tags).toEqual(['novela'])
    expect(f.descripcion).toContain('Clásico sobre la culpa')
    expect(f.descripcion).toContain('Stock por tienda')
  })
  it('fila sin precio válido → null', () => {
    const row = ['978-2','Sin precio','A','E','1','2000','','0','0','0','0','','']
    expect(mapearFila(row, idx, 'libros')).toBeNull()
  })
})

describe('textoEmbed — libros incluye autor y género', () => {
  it('compone titulo + autor + editorial + genero + descripcion', () => {
    const f: FilaProducto = { nombre: 'El Proceso', precio: 50, stock: 3, marca: 'Tusquets', tags: ['novela'], atributos: { autor: 'Kafka' }, descripcion: 'culpa' }
    const t = textoEmbed(f, 'libros')
    expect(t).toContain('El Proceso'); expect(t).toContain('Kafka'); expect(t).toContain('novela')
  })
})

// Fake DB: select de skus existentes + captura de insert/upsert/delete/rpc
function fakeDb(existentes: string[], capt: Record<string, unknown>) {
  const api: Record<string, unknown> = {
    from() { return api },
    select() { return api },
    eq() { return Promise.resolve({ data: existentes.map((sku) => ({ sku })), error: null }) },
    insert(rows: unknown) { capt.inserted = rows; return Promise.resolve({ error: null }) },
    upsert(rows: unknown, opts: unknown) { capt.upserted = rows; capt.opts = opts; return Promise.resolve({ error: null }) },
    delete() { capt.deleted = true; return { eq() { return Promise.resolve({ error: null }) } } },
    rpc(fn: string, args: unknown) { capt.rpcFn = fn; capt.rpcArgs = args; return Promise.resolve({ data: (args as { p_filas: unknown[] }).p_filas.length, error: null }) },
  }
  return api as unknown as SupabaseClient
}

const CSV_LIBROS = [
  ['isbn','titulo','autor','editorial','edicion','anio','precio_soles','stock_central','stock_miraflores','stock_sanisidro','stock_total','genero','descripcion'],
  ['978-1','El Proceso','Kafka','Tusquets','1','1925','50','2','0','1','3','novela','culpa'],
  ['978-NUEVO','Nuevo','A','E','1','2020','30','1','1','1','3','','sin desc'],
]

// CSV with duplicate SKU: 978-DUP appears twice; second occurrence should win
const CSV_CON_DUP = [
  ['isbn','titulo','autor','editorial','edicion','anio','precio_soles','stock_central','stock_miraflores','stock_sanisidro','stock_total','genero','descripcion'],
  ['978-DUP','Primera edición','A','E','1','2000','20','1','0','0','1','ficcion','primera'],
  ['978-UNICO','Libro único','B','F','1','2010','35','2','0','0','2','historia','único'],
  ['978-DUP','Segunda edición','A','E','2','2005','25','3','0','0','3','ficcion','segunda'],
]

describe('previsualizar', () => {
  it('cuenta válidas/aActualizar/aAgregar/sinGenero', async () => {
    const r = await previsualizar(CSV_LIBROS, 'actualizar', 6, fakeDb(['978-1'], {}))
    expect(r.formato).toBe('libros')
    expect(r.validas).toBe(2)
    expect(r.aActualizar).toBe(1)   // 978-1 ya existe
    expect(r.aAgregar).toBe(1)      // 978-NUEVO
    expect(r.sinGenero).toBe(1)     // la fila Nuevo no trae genero
  })

  it('CSV con sku duplicado → validas cuenta el set deduplicado y duplicadosSku refleja los descartados', async () => {
    // 3 filas válidas, 1 sku duplicado → 2 validas (deduped), 1 duplicadosSku
    const r = await previsualizar(CSV_CON_DUP, 'actualizar', 6, fakeDb([], {}))
    expect(r.validas).toBe(2)
    expect(r.duplicadosSku).toBe(1)
    // total should account for all original rows (validas + invalidas + duplicadosSku)
    expect(r.total).toBe(3)
  })

  it('CSV con sku duplicado modo reemplazar → mismos conteos', async () => {
    const r = await previsualizar(CSV_CON_DUP, 'reemplazar', 6, fakeDb([], {}))
    expect(r.validas).toBe(2)
    expect(r.duplicadosSku).toBe(1)
  })
})

describe('importar', () => {
  const embedFake = async () => [0.1, 0.2]

  it('modo actualizar → upsert por (tenant_id,sku) con embedding', async () => {
    const capt: Record<string, unknown> = {}
    const r = await importar(CSV_LIBROS, 'actualizar', 6, fakeDb(['978-1'], capt), embedFake)
    expect(r.importados + r.actualizados).toBe(2)
    expect(capt.opts).toEqual({ onConflict: 'tenant_id,sku' })
    expect(Array.isArray(capt.upserted)).toBe(true)
  })

  it('modo actualizar con sku duplicado → upsert recibe set deduplicado (no hay sku repetido en el payload)', async () => {
    const capt: Record<string, unknown> = {}
    await importar(CSV_CON_DUP, 'actualizar', 6, fakeDb([], capt), embedFake)
    const upserted = capt.upserted as Array<{ sku: string }>
    const skus = upserted.map((r) => r.sku)
    // No duplicate skus in the upsert payload
    expect(new Set(skus).size).toBe(skus.length)
    // Only 2 rows after dedup (978-DUP + 978-UNICO)
    expect(upserted.length).toBe(2)
    // Last-wins: the second occurrence of 978-DUP should be kept
    const dup = upserted.find((r) => r.sku === '978-DUP') as unknown as { nombre: string } | undefined
    expect(dup?.nombre).toBe('Segunda edición')
  })

  it('modo reemplazar → llama RPC reemplazar_catalogo (NO delete+insert separados)', async () => {
    const capt: Record<string, unknown> = {}
    const r = await importar(CSV_LIBROS, 'reemplazar', 6, fakeDb([], capt), embedFake)
    // Must call rpc
    expect(capt.rpcFn).toBe('reemplazar_catalogo')
    expect((capt.rpcArgs as { p_tenant_id: number }).p_tenant_id).toBe(6)
    expect(Array.isArray((capt.rpcArgs as { p_filas: unknown[] }).p_filas)).toBe(true)
    // Must NOT use the old separate delete+insert
    expect(capt.deleted).toBeUndefined()
    expect(capt.inserted).toBeUndefined()
    expect(r.importados).toBe(2)
    expect(r.actualizados).toBe(0)
  })

  it('modo reemplazar com sku duplicado → RPC recebe set deduplicado', async () => {
    const capt: Record<string, unknown> = {}
    await importar(CSV_CON_DUP, 'reemplazar', 6, fakeDb([], capt), embedFake)
    expect(capt.rpcFn).toBe('reemplazar_catalogo')
    const filas = (capt.rpcArgs as { p_filas: unknown[] }).p_filas
    expect(filas.length).toBe(2)
  })
})
