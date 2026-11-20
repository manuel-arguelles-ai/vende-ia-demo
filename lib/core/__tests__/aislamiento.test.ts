// lib/core/__tests__/aislamiento.test.ts
// Tests unitarios de aislamiento por tenant.
// Usan mocks de DB al estilo de negocio.test.ts / historial.test.ts (patrón Task 5).
// La aplicación REAL de RLS se verifica manualmente en staging.
import { describe, it, expect, vi } from 'vitest'
import { obtenerNegocio } from '../negocio'
import { cargarHistorial } from '../historial'
import { botPausado } from '../control'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock encadenable que captura las llamadas a .eq()
function dbMockConEq(data: unknown = null) {
  const eqCalls: Array<[string, unknown]> = []
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null })
  const limit = vi.fn().mockResolvedValue({ data: data ? [data] : [], error: null })
  const order = vi.fn().mockReturnValue({ limit })
  const eq = vi.fn().mockImplementation((col: string, val: unknown) => {
    eqCalls.push([col, val])
    return { eq, maybeSingle, order }
  })
  const select = vi.fn().mockReturnValue({ eq })
  const upsert = vi.fn().mockResolvedValue({ data: null, error: null })
  const from = vi.fn().mockReturnValue({ select, eq, upsert, maybeSingle })
  return { db: { from } as unknown as SupabaseClient, eqCalls }
}

describe('aislamiento por tenant — obtenerNegocio', () => {
  it('tenant 1 nunca filtra por tenant_id=2', async () => {
    const { db, eqCalls } = dbMockConEq({ datos: { nombre: 'Tienda Demo' } })
    await obtenerNegocio(1, db)
    expect(eqCalls).toContainEqual(['tenant_id', 1])
    expect(eqCalls).not.toContainEqual(['tenant_id', 2])
  })

  it('tenant 2 nunca filtra por tenant_id=1', async () => {
    const { db, eqCalls } = dbMockConEq(null)
    await obtenerNegocio(2, db)
    expect(eqCalls).toContainEqual(['tenant_id', 2])
    expect(eqCalls).not.toContainEqual(['tenant_id', 1])
  })
})

describe('aislamiento por tenant — cargarHistorial', () => {
  it('tenant 1 filtra mensajes solo de tenant 1, nunca de tenant 2', async () => {
    const eqCalls: Array<[string, unknown]> = []
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn().mockReturnValue({ limit })
    const eq = vi.fn().mockImplementation((col: string, val: unknown) => {
      eqCalls.push([col, val])
      return { eq, order }
    })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    const db = { from } as unknown as SupabaseClient
    await cargarHistorial('51999', 1, db)
    expect(eqCalls).toContainEqual(['tenant_id', 1])
    expect(eqCalls).not.toContainEqual(['tenant_id', 2])
  })

  it('tenant 2 filtra mensajes solo de tenant 2, nunca de tenant 1', async () => {
    const eqCalls: Array<[string, unknown]> = []
    const limit = vi.fn().mockResolvedValue({ data: [], error: null })
    const order = vi.fn().mockReturnValue({ limit })
    const eq = vi.fn().mockImplementation((col: string, val: unknown) => {
      eqCalls.push([col, val])
      return { eq, order }
    })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    const db = { from } as unknown as SupabaseClient
    await cargarHistorial('51999', 2, db)
    expect(eqCalls).toContainEqual(['tenant_id', 2])
    expect(eqCalls).not.toContainEqual(['tenant_id', 1])
  })
})

describe('aislamiento por tenant — botPausado', () => {
  it('tenant 1 controla leads de tenant 1, no de tenant 2', async () => {
    const { db, eqCalls } = dbMockConEq({ bot_pausado: true })
    await botPausado('51999@lid', 1, db)
    expect(eqCalls).toContainEqual(['tenant_id', 1])
    expect(eqCalls).not.toContainEqual(['tenant_id', 2])
  })

  it('tenant 2 controla leads de tenant 2, no de tenant 1', async () => {
    const { db, eqCalls } = dbMockConEq({ bot_pausado: false })
    await botPausado('51999@lid', 2, db)
    expect(eqCalls).toContainEqual(['tenant_id', 2])
    expect(eqCalls).not.toContainEqual(['tenant_id', 1])
  })
})
