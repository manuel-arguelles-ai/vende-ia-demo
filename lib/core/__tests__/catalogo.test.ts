import { describe, it, expect, vi } from 'vitest'
import { buscarProductos, buscarProducto } from '../catalogo'
import type { SupabaseClient } from '@supabase/supabase-js'

function dbCon(filas: unknown[]) {
  return { rpc: vi.fn().mockResolvedValue({ data: filas, error: null }) } as unknown as SupabaseClient
}
const sinEmbedding = async () => null

const base = {
  nombre: 'Tayta Kombucha - 355 ml', marca: 'Tayta', precio: '60.00',
  presentacion: '355 ml', stock: 33, categoria: 'Bebidas',
  descripcion: 'Bebida fermentada probiótica, sabores variados',
}

describe('buscarProductos – filtro de tenant', () => {
  it('pasa p_tenant_id al rpc cuando se especifica tenantId', async () => {
    const db = dbCon([])
    await buscarProductos('kombucha', 2, db, sinEmbedding)
    expect(db.rpc).toHaveBeenCalledWith('buscar_productos', expect.objectContaining({ p_tenant_id: 2 }))
  })

  it('default tenantId=1 mantiene Tienda Demo', async () => {
    const db = dbCon([])
    await buscarProductos('kombucha', 1, db, sinEmbedding)
    expect(db.rpc).toHaveBeenCalledWith('buscar_productos', expect.objectContaining({ p_tenant_id: 1 }))
  })
})

describe('buscarProductos (cortes de honestidad)', () => {
  it('match léxico AND → confianza alta', async () => {
    const db = dbCon([{ ...base, metodos: 'and+or+vec', puntaje: 0.54, sim_vec: 0.68 }])
    const r = await buscarProductos('kombucha', 1, db, sinEmbedding)
    expect(r).toHaveLength(1)
    expect(r[0].confianza).toBe('alta')
    expect(r[0].precio).toBe(60)
  })

  it('typo resuelto por trigram → confianza alta', async () => {
    const db = dbCon([{ ...base, metodos: 'trgm+vec', puntaje: 0.3, sim_vec: 0.66 }])
    const r = await buscarProductos('konbucha', 1, db, sinEmbedding)
    expect(r[0].confianza).toBe('alta')
  })

  it('pariente semántico (vec alto) → confianza media', async () => {
    const db = dbCon([{ ...base, metodos: 'vec', puntaje: 0.18, sim_vec: 0.72 }])
    const r = await buscarProductos('algo para la digestión', 1, db, sinEmbedding)
    expect(r[0].confianza).toBe('media')
  })

  it('ruido vec-only por debajo del umbral → vacío honesto', async () => {
    const db = dbCon([
      { ...base, nombre: 'Sal Rosada', metodos: 'vec', puntaje: 0.18, sim_vec: 0.63 },
      { ...base, nombre: 'Olla Ceramic', metodos: 'vec', puntaje: 0.15, sim_vec: 0.62 },
    ])
    const r = await buscarProductos('limpiador de horno', 1, db, sinEmbedding)
    expect(r).toEqual([])
  })

  it('or débil sin vec → descartado', async () => {
    const db = dbCon([{ ...base, metodos: 'or', puntaje: 0.09, sim_vec: null }])
    const r = await buscarProductos('bebida para hidratación', 1, db, sinEmbedding)
    expect(r).toEqual([])
  })

  it('query vacía o null → vacío sin tocar la DB', async () => {
    const db = dbCon([])
    expect(await buscarProductos(null, 1, db, sinEmbedding)).toEqual([])
    expect(await buscarProductos('  ', 1, db, sinEmbedding)).toEqual([])
  })

  it('buscarProducto (legacy) devuelve el mejor match o null', async () => {
    const db = dbCon([{ ...base, metodos: 'and', puntaje: 0.5, sim_vec: null }])
    const uno = await buscarProducto('kombucha', 1, db, sinEmbedding)
    expect(uno?.nombre).toContain('Kombucha')
    const db2 = dbCon([])
    expect(await buscarProducto('xyz', 1, db2, sinEmbedding)).toBeNull()
  })
})
