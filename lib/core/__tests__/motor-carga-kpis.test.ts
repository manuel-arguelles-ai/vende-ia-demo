// lib/core/__tests__/motor-carga-kpis.test.ts
import { describe, it, expect, vi } from 'vitest'
import { cargaPorAsesor, kpisPorAsesor } from '../motor-asignacion'
import type { SupabaseClient } from '@supabase/supabase-js'

// control_leads asignados: a1→[r1,r2,r3], a2→[r4]; cierres: r2 (a1 lo cerró), r4 (a2)
vi.mock('../gestion', () => ({
  cierresPorRemitente: vi.fn(async () => new Map([['r2', { estado: 'ganado', monto: 10 }], ['r4', { estado: 'ganado', monto: 5 }]])),
}))

function fakeDb(leads: { remitente: string; asignado_a: number }[]) {
  const api: Record<string, unknown> = {
    from() { return api },
    select() { return api },
    eq() { return api },
    not() { return Promise.resolve({ data: leads, error: null }) },
    then(res: (v: unknown) => void) { return Promise.resolve({ data: leads, error: null }).then(res) },
  }
  return api as unknown as SupabaseClient
}

const LEADS = [
  { remitente: 'r1', asignado_a: 1 }, { remitente: 'r2', asignado_a: 1 }, { remitente: 'r3', asignado_a: 1 },
  { remitente: 'r4', asignado_a: 2 },
]

describe('cargaPorAsesor', () => {
  it('cuenta asignados activos (excluye cerrados)', async () => {
    const carga = await cargaPorAsesor(6, fakeDb(LEADS))
    expect(carga.get(1)).toBe(2)  // r1, r3 (r2 cerrado)
    expect(carga.get(2)).toBe(0)  // r4 cerrado
  })
})
describe('kpisPorAsesor', () => {
  it('asignados/cerrados/activos/conversion', async () => {
    const k = await kpisPorAsesor(6, fakeDb(LEADS))
    expect(k.get(1)).toMatchObject({ asignados: 3, cerrados: 1, activos: 2 })
    expect(k.get(1)!.conversion).toBeCloseTo(1 / 3)
    expect(k.get(2)).toMatchObject({ asignados: 1, cerrados: 1, activos: 0, conversion: 1 })
  })
})
