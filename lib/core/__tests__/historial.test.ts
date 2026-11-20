import { describe, it, expect, vi } from 'vitest'
import { cargarHistorial, guardarMensaje } from '../historial'

function fakeDb(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue({ data: rows, error: null })
  const order = vi.fn().mockReturnValue({ limit })
  const eq = vi.fn().mockReturnValue({ order, eq: vi.fn().mockReturnValue({ order }) })
  const select = vi.fn().mockReturnValue({ eq })
  const insert = vi.fn().mockResolvedValue({ error: null })
  const from = vi.fn().mockReturnValue({ select, insert })
  return { client: { from } as never, from, insert, select, eq }
}

describe('historial', () => {
  it('cargarHistorial devuelve los turnos en orden cronológico (revierte el desc)', async () => {
    const { client } = fakeDb([
      { rol: 'bot', texto: 'segundo' },
      { rol: 'cliente', texto: 'primero' },
    ])
    const h = await cargarHistorial('51999', 1, client)
    expect(h).toEqual([
      { rol: 'cliente', texto: 'primero' },
      { rol: 'bot', texto: 'segundo' },
    ])
  })

  it('cargarHistorial filtra por remitente', async () => {
    const eqCalls: Array<[string, unknown]> = []
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn().mockReturnValue({ limit })
    const eq = vi.fn().mockImplementation((col: string, val: unknown) => {
      eqCalls.push([col, val])
      return { eq, order }
    })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    const client = { from } as never
    await cargarHistorial('51999', 1, client)
    expect(eqCalls).toContainEqual(['remitente', '51999'])
  })

  it('guardarMensaje inserta el turno en mensajes con tenant_id inyectado por scoped()', async () => {
    // db crudo pasado a guardarMensaje → scoped(db, 1) inyecta tenant_id en el insert.
    // Si scoped() dejara de inyectar tenant_id, la aserción objectContaining({ tenant_id: 1 }) fallaría.
    const { client, from, insert } = fakeDb([])
    await guardarMensaje('51999', 'cliente', 'hola', null, 1, client)
    expect(from).toHaveBeenCalledWith('mensajes')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ remitente: '51999', rol: 'cliente', texto: 'hola', tenant_id: 1 }),
    )
  })
})

describe('historial – filtro de tenant', () => {
  it('cargarHistorial filtra por tenant_id', async () => {
    // Mock para scoped: necesitamos capturar la llamada .eq('tenant_id', N)
    const eqCalls: Array<[string, unknown]> = []
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn().mockReturnValue({ limit })
    const eq = vi.fn().mockImplementation((col: string, val: unknown) => {
      eqCalls.push([col, val])
      return { eq, order }
    })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    const db = { from } as never
    await cargarHistorial('51999', 2, db)
    expect(eqCalls).toContainEqual(['tenant_id', 2])
  })

  it('default tenantId=1 aplica tenant 1', async () => {
    const eqCalls: Array<[string, unknown]> = []
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn().mockReturnValue({ limit })
    const eq = vi.fn().mockImplementation((col: string, val: unknown) => {
      eqCalls.push([col, val])
      return { eq, order }
    })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    const db = { from } as never
    await cargarHistorial('51999', 1, db)
    expect(eqCalls).toContainEqual(['tenant_id', 1])
  })

  it('guardarMensaje incluye tenant_id en el insert', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn().mockReturnValue({ insert: insertMock })
    const db = { from } as never
    await guardarMensaje('51999', 'cliente', 'hola', null, 2, db)
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 2 }),
    )
  })
})
