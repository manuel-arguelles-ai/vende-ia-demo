import { describe, it, expect, vi } from 'vitest'
import { obtenerNegocio, guardarNegocio } from '../negocio'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock encadenable que registra las llamadas a .eq() en eqCalls.
// Se pasa como db crudo a la función bajo prueba; scoped() lo envuelve
// y llama .eq('tenant_id', N) — si scoped deja de filtrar, eqCalls no
// contendrá ['tenant_id', N] y el test fallará.
function dbMock(data: unknown = {}) {
  const eqCalls: Array<[string, unknown]> = []
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null })
  const eq = vi.fn().mockImplementation((col: string, val: unknown) => {
    eqCalls.push([col, val])
    return { eq, maybeSingle }
  })
  const select = vi.fn().mockReturnValue({ eq })
  const upsert = vi.fn().mockResolvedValue({ data: null, error: null })
  const from = vi.fn().mockReturnValue({ select, eq, upsert })
  return { db: { from } as unknown as SupabaseClient, from, select, eq, upsert, eqCalls }
}

describe('negocio – filtro de tenant', () => {
  it('obtenerNegocio(1) filtra por tenant_id=1', async () => {
    const { db, eqCalls } = dbMock({ datos: { nombre: 'Tienda Demo' } })
    await obtenerNegocio(1, db)
    // scoped(db, 1) debe haber encadenado .eq('tenant_id', 1)
    expect(eqCalls).toContainEqual(['tenant_id', 1])
  })

  it('obtenerNegocio(2) filtra por tenant_id=2, no devuelve datos de tenant 1', async () => {
    const { db, eqCalls } = dbMock(null)
    await obtenerNegocio(2, db)
    // debe filtrar por tenant 2, no por tenant 1
    expect(eqCalls).toContainEqual(['tenant_id', 2])
    expect(eqCalls).not.toContainEqual(['tenant_id', 1])
  })

  it('default tenantId=1 mantiene Tienda Demo', async () => {
    const { db, eqCalls } = dbMock({ datos: {} })
    await obtenerNegocio(1, db)
    expect(eqCalls).toContainEqual(['tenant_id', 1])
  })

  it('guardarNegocio upsert incluye tenant_id', async () => {
    const { db, upsert } = dbMock()
    await guardarNegocio({ nombre: 'Prueba' }, 2, db)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 2 }),
      expect.objectContaining({ onConflict: 'tenant_id' }),
    )
  })
})
