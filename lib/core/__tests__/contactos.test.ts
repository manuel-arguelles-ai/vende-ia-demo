import { describe, it, expect, vi } from 'vitest'
import { enriquecerContacto, guardarContacto, eliminarContacto, listarContactos } from '../contactos'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock encadenable que registra llamadas eq
function dbMock(data: unknown = null) {
  const eqCalls: Array<[string, unknown]> = []
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const order = vi.fn().mockResolvedValue({ data: data ?? [], error: null })

  // delete chain: .delete().eq().eq() → thenable
  const delResult = { then: (r: (v: unknown) => void) => r({ error: null }), eq: vi.fn() }
  delResult.eq = vi.fn().mockImplementation((col: string, val: unknown) => {
    eqCalls.push([col, val])
    return delResult
  })
  const deleteFn = vi.fn().mockReturnValue(delResult)

  // maybeSingle: para enriquecerContacto que hace select().eq().maybeSingle()
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null })
  const eqChain = vi.fn().mockImplementation((col: string, val: unknown) => {
    eqCalls.push([col, val])
    return { eq: eqChain, maybeSingle, order, then: (r: (v: unknown) => void) => r({ data, error: null }) }
  })
  const select = vi.fn().mockReturnValue({ eq: eqChain, order, maybeSingle })
  const from = vi.fn().mockReturnValue({ select, upsert, delete: deleteFn })
  return { db: { from } as unknown as SupabaseClient, from, select, upsert, deleteFn, eqCalls }
}

describe('contactos – filtro de tenant', () => {
  it('enriquecerContacto filtra por tenant_id al leer', async () => {
    const { db, eqCalls } = dbMock(null)
    await enriquecerContacto('51999', { nombre: 'Ana' }, 2, db)
    expect(eqCalls).toContainEqual(['tenant_id', 2])
  })

  it('enriquecerContacto upsert incluye tenant_id', async () => {
    const { db, upsert } = dbMock(null)
    await enriquecerContacto('51999', { nombre: 'Ana' }, 2, db)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 2 }),
      expect.anything(),
    )
  })

  it('guardarContacto upsert incluye tenant_id', async () => {
    const { db, upsert } = dbMock(null)
    await guardarContacto('51999', { nombre: 'Ana' }, 2, db)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 2 }),
      expect.anything(),
    )
  })

  it('eliminarContacto filtra por tenant_id (via scoped delete)', async () => {
    const { db, eqCalls } = dbMock(null)
    await eliminarContacto('51999', 2, db)
    expect(eqCalls).toContainEqual(['tenant_id', 2])
  })

  it('listarContactos filtra por tenant_id', async () => {
    const { db, eqCalls, select } = dbMock([])
    // listarContactos usa scoped().from().select().order()
    const eqForList: Array<[string, unknown]> = []
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null })
    const eqMock = vi.fn().mockImplementation((col: string, val: unknown) => {
      eqForList.push([col, val])
      return { eq: eqMock, order: orderMock }
    })
    vi.mocked(select).mockReturnValue({ eq: eqMock, order: orderMock })
    await listarContactos(2, db)
    expect(eqForList).toContainEqual(['tenant_id', 2])
  })

  it('default tenantId=1 aplica tenant 1', async () => {
    const { db, eqCalls } = dbMock(null)
    await eliminarContacto('51999', 1, db)
    expect(eqCalls).toContainEqual(['tenant_id', 1])
  })
})
