import { describe, it, expect } from 'vitest'
import { metricasTenants } from '../plataforma'
import type { SupabaseClient } from '@supabase/supabase-js'

// fakeDb: 1 tenant con 4 pedidos, 2 cierres → conversion 0.5
function fakeDb() {
  const counts: Record<string, number> = { usuarios: 1, mensajes: 10, pedidos: 4, productos: 5, cierres: 2 }
  let tabla = ''
  const api: Record<string, unknown> = {
    from(t: string) { tabla = t; return api },
    select(_c: string, opts?: { head?: boolean }) {
      if (opts?.head) return { eq: () => Promise.resolve({ count: counts[tabla] ?? 0 }) }
      return api
    },
    eq() { return api },
    order() { return api },
    limit() { return Promise.resolve({ data: [] }) },
    maybeSingle() { return Promise.resolve({ data: null, error: null }) },
    then(res: (v: unknown) => void) {
      if (tabla === 'tenants') return Promise.resolve({ data: [{ id: 1, nombre: 'T', slug: 't', estado: 'activo', plan: 'free', created_at: '2026-01-01' }], error: null }).then(res)
      return Promise.resolve({ data: [], error: null }).then(res)
    },
  }
  return api as unknown as SupabaseClient
}

describe('metricasTenants conversion/cierres/canal', () => {
  it('incluye cierres, conversion (cierres/pedidos) y canal del mapa de salud', async () => {
    const salud = { porTenant: new Map([[1, true]]), workerCaido: false }
    const r = await metricasTenants(fakeDb(), salud)
    expect(r[0].cierres).toBe(2)
    expect(r[0].conversion).toBeCloseTo(0.5)
    expect(r[0].canal).toBe('conectado')
  })
})
