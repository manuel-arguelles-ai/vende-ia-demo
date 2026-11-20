import { describe, it, expect, vi } from 'vitest'
import { registrarEvento, eventosRecientes } from '../eventos'

// DB falsa mínima para insert y select-order-limit.
function dbInsertOk() {
  const insert = vi.fn().mockResolvedValue({ error: null })
  return { client: { from: vi.fn(() => ({ insert })) } as never, insert }
}

describe('registrarEvento', () => {
  it('inserta tipo, tenant_id y detalle', async () => {
    const { client, insert } = dbInsertOk()
    await registrarEvento('tenant_creado', 7, { email: 'a@b.com' }, client)
    expect(insert).toHaveBeenCalledWith({ tipo: 'tenant_creado', tenant_id: 7, detalle: { email: 'a@b.com' } })
  })

  it('detalle default vacío cuando no se pasa', async () => {
    const { client, insert } = dbInsertOk()
    await registrarEvento('whatsapp_conectado', 3, undefined, client)
    expect(insert).toHaveBeenCalledWith({ tipo: 'whatsapp_conectado', tenant_id: 3, detalle: {} })
  })

  it('fail-open: si el insert lanza, NO propaga el error', async () => {
    const insert = vi.fn().mockRejectedValue(new Error('boom'))
    const client = { from: vi.fn(() => ({ insert })) } as never
    await expect(registrarEvento('x', 1, {}, client)).resolves.toBeUndefined()
  })

  it('fail-open: si el insert devuelve error, no lanza', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'rls' } })
    const client = { from: vi.fn(() => ({ insert })) } as never
    await expect(registrarEvento('x', 1, {}, client)).resolves.toBeUndefined()
  })
})

describe('eventosRecientes', () => {
  it('devuelve las filas ordenadas desc con el límite pedido', async () => {
    const rows = [{ id: 2, tipo: 'a', tenant_id: 1, detalle: {}, created_at: 'z' }]
    const limit = vi.fn().mockResolvedValue({ data: rows, error: null })
    const order = vi.fn(() => ({ limit }))
    const select = vi.fn(() => ({ order }))
    const client = { from: vi.fn(() => ({ select })) } as never

    const out = await eventosRecientes(20, client)
    expect(select).toHaveBeenCalled()
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(limit).toHaveBeenCalledWith(20)
    expect(out).toEqual(rows)
  })

  it('si hay error devuelve []', async () => {
    const limit = vi.fn().mockResolvedValue({ data: null, error: { message: 'x' } })
    const order = vi.fn(() => ({ limit }))
    const select = vi.fn(() => ({ order }))
    const client = { from: vi.fn(() => ({ select })) } as never
    expect(await eventosRecientes(5, client)).toEqual([])
  })
})
