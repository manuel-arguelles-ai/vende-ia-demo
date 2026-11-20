import { describe, it, expect, vi } from 'vitest'
import { agregarEtiqueta, quitarEtiqueta, etiquetasPorRemitente } from '../etiquetas'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock encadenable completo: todos los métodos devuelven el mismo objeto
// para soportar cadenas como .select().eq().order() y .delete().eq().eq()
function dbMock(data: unknown = []) {
  const eqCalls: Array<[string, unknown]> = []
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const delFn = vi.fn().mockResolvedValue({ error: null })
  const order = vi.fn().mockResolvedValue({ data, error: null })

  // Objeto thenable para el resultado final de delete().eq().eq()
  const delResult = {
    then: (r: (v: unknown) => void) => r({ error: null }),
    eq: vi.fn(),
  }
  delResult.eq = vi.fn().mockImplementation((col: string, val: unknown) => {
    eqCalls.push([col, val])
    return delResult
  })

  const eqOnDel = vi.fn().mockImplementation((col: string, val: unknown) => {
    eqCalls.push([col, val])
    return delResult
  })

  // Para scoped: .from('t').delete() devuelve algo con .eq()
  const deleteMock = vi.fn().mockReturnValue({ eq: eqOnDel, then: (r: (v: unknown) => void) => r({ error: null }) })

  // Para scoped select: .from('t').select().eq('tenant_id', N).order()
  const eqOnSelect = vi.fn().mockImplementation((col: string, val: unknown) => {
    eqCalls.push([col, val])
    return { eq: eqOnSelect, order, then: (r: (v: unknown) => void) => r({ data, error: null }) }
  })
  const select = vi.fn().mockReturnValue({ eq: eqOnSelect, order })

  const from = vi.fn().mockReturnValue({ select, upsert, delete: deleteMock })
  return { db: { from } as unknown as SupabaseClient, from, select, upsert, deleteMock, eqCalls }
}

describe('etiquetas – filtro de tenant', () => {
  it('agregarEtiqueta upsert incluye tenant_id', async () => {
    const { db, upsert } = dbMock()
    await agregarEtiqueta('51999', 'interesado', 'manual', 2, db)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 2 }),
      expect.anything(),
    )
  })

  it('default tenantId=1 en agregarEtiqueta', async () => {
    const { db, upsert } = dbMock()
    await agregarEtiqueta('51999', 'interesado', 'manual', 1, db)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 1 }),
      expect.anything(),
    )
  })

  it('quitarEtiqueta filtra por tenant_id', async () => {
    const { db, eqCalls } = dbMock()
    await quitarEtiqueta('51999', 'interesado', 2, db)
    expect(eqCalls).toContainEqual(['tenant_id', 2])
  })

  it('etiquetasPorRemitente filtra por tenant_id', async () => {
    const { db, eqCalls } = dbMock([])
    await etiquetasPorRemitente(2, db)
    expect(eqCalls).toContainEqual(['tenant_id', 2])
  })
})
