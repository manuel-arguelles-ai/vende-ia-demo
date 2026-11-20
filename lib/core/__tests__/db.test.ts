import { describe, it, expect, vi } from 'vitest'
import { insertPedido, ultimoPedido } from '../db'
import type { PedidoGuardado } from '../schemas'

const row: PedidoGuardado = {
  producto: 'polera', color: 'roja', talla: 'M', cantidad: 1, extra: {},
  necesita_aclaracion: false, temperatura: 'caliente', score: 90, razon: 'x',
  canal: 'whatsapp', remitente: '51999', mensaje_crudo: 'polera roja M', derivar: true, estado: 'nuevo',
}

function fakeDb(returned: unknown) {
  const single = vi.fn().mockResolvedValue({ data: returned, error: null })
  const select = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select })
  const from = vi.fn().mockReturnValue({ insert })
  return { client: { from } as any, insert, from }
}

describe('insertPedido', () => {
  it('inserta en la tabla pedidos y devuelve la fila, con tenant_id inyectado por scoped()', async () => {
    // db crudo → scoped(db, 1) inyecta tenant_id en el insert vía ScopedTable.
    // Si scoped() dejara de inyectar, objectContaining({ tenant_id: 1 }) fallaría.
    const { client, from, insert } = fakeDb({ ...row, id: 1 })
    const saved = await insertPedido(row, 1, client)
    expect(from).toHaveBeenCalledWith('pedidos')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ producto: 'polera', derivar: true, tenant_id: 1 }),
    )
    expect(saved.id).toBe(1)
  })

  it('lanza si Supabase devuelve error', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    const client = { from: () => ({ insert: () => ({ select: () => ({ single }) }) }) } as any
    await expect(insertPedido(row, 1, client)).rejects.toThrow('boom')
  })
})

describe('db – filtro de tenant', () => {
  it('ultimoPedido filtra por tenant_id', async () => {
    const eqCalls: Array<[string, unknown]> = []
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn().mockReturnValue({ limit })
    const eq = vi.fn().mockImplementation((col: string, val: unknown) => {
      eqCalls.push([col, val])
      return { eq, order }
    })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    const db = { from } as any
    await ultimoPedido('51999', 2, db)
    expect(eqCalls).toContainEqual(['tenant_id', 2])
  })

  it('insertPedido inyecta tenant_id en el insert', async () => {
    const single = vi.fn().mockResolvedValue({ data: { ...row, id: 1, tenant_id: 2 }, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    const from = vi.fn().mockReturnValue({ insert })
    const db = { from } as any
    await insertPedido(row, 2, db)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: 2 }))
  })

  it('default tenantId=1 en ultimoPedido', async () => {
    const eqCalls: Array<[string, unknown]> = []
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn().mockReturnValue({ limit })
    const eq = vi.fn().mockImplementation((col: string, val: unknown) => {
      eqCalls.push([col, val])
      return { eq, order }
    })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    const db = { from } as any
    await ultimoPedido('51999', 1, db)
    expect(eqCalls).toContainEqual(['tenant_id', 1])
  })
})
