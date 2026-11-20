// lib/core/__tests__/listar-usuarios-saturado.test.ts
// Tests for saturado using limite_default fallback (Fix 1)
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the three dependencies that listarUsuarios calls internally
vi.mock('../motor-asignacion', () => ({
  kpisPorAsesor: vi.fn(),
  cargaPorAsesor: vi.fn(),
}))
vi.mock('../negocio', () => ({
  obtenerNegocio: vi.fn(),
}))

import { listarUsuarios } from '../usuarios'
import { kpisPorAsesor, cargaPorAsesor } from '../motor-asignacion'
import { obtenerNegocio } from '../negocio'
import type { SupabaseClient } from '@supabase/supabase-js'

const kpisMock = vi.mocked(kpisPorAsesor)
const cargaMock = vi.mocked(cargaPorAsesor)
const negocioMock = vi.mocked(obtenerNegocio)

// Minimal fakeDb that only needs to serve usuarios and control_leads reads
function fakeDb(usuarios: Record<string, unknown>[], leads: Record<string, unknown>[] = []) {
  const api: Record<string, unknown> = {
    from(t: string) { api._tabla = t; return api },
    select() { return api },
    eq() { return api },
    then(res: (v: unknown) => void) {
      const tabla = api._tabla as string
      if (tabla === 'usuarios') return Promise.resolve({ data: usuarios, error: null }).then(res)
      if (tabla === 'control_leads') return Promise.resolve({ data: leads, error: null }).then(res)
      return Promise.resolve({ data: [], error: null }).then(res)
    },
    _tabla: '',
  }
  return api as unknown as SupabaseClient
}

beforeEach(() => {
  kpisMock.mockResolvedValue(new Map())
  cargaMock.mockResolvedValue(new Map())
  negocioMock.mockResolvedValue({ asignacion: { regla: 'round_robin', limite_default: 20, ultimo_asesor_id: null } })
})

describe('listarUsuarios – saturado usa limite_default como fallback', () => {
  it('limite_activos=null, activos >= limite_default → saturado: true', async () => {
    const advisorId = 10
    // 3 activos, limite_default = 3 → saturado
    cargaMock.mockResolvedValue(new Map([[advisorId, 3]]))
    negocioMock.mockResolvedValue({ asignacion: { regla: 'round_robin', limite_default: 3, ultimo_asesor_id: null } })

    const db = fakeDb([
      { id: advisorId, tenant_id: 6, nombre: 'Carlos', email: 'c@x.com', rol: 'asesor', activo: true, peso: 1, limite_activos: null },
    ])

    const lista = await listarUsuarios(6, db)
    expect(lista).toHaveLength(1)
    expect(lista[0].saturado).toBe(true)
  })

  it('limite_activos=null, activos < limite_default → saturado: false', async () => {
    const advisorId = 11
    // 2 activos, limite_default = 5 → not saturado
    cargaMock.mockResolvedValue(new Map([[advisorId, 2]]))
    negocioMock.mockResolvedValue({ asignacion: { regla: 'round_robin', limite_default: 5, ultimo_asesor_id: null } })

    const db = fakeDb([
      { id: advisorId, tenant_id: 6, nombre: 'Diana', email: 'd@x.com', rol: 'asesor', activo: true, peso: 1, limite_activos: null },
    ])

    const lista = await listarUsuarios(6, db)
    expect(lista).toHaveLength(1)
    expect(lista[0].saturado).toBe(false)
  })

  it('limite_activos=5 (explicit), activos=5 → saturado: true (own limit wins)', async () => {
    const advisorId = 12
    cargaMock.mockResolvedValue(new Map([[advisorId, 5]]))
    // negocio.limite_default = 20, but user has own limit_activos=5
    negocioMock.mockResolvedValue({ asignacion: { regla: 'round_robin', limite_default: 20, ultimo_asesor_id: null } })

    const db = fakeDb([
      { id: advisorId, tenant_id: 6, nombre: 'Elena', email: 'e@x.com', rol: 'asesor', activo: true, peso: 1, limite_activos: 5 },
    ])

    const lista = await listarUsuarios(6, db)
    expect(lista[0].saturado).toBe(true)
  })

  it('negocio sin asignacion → fallback hardcoded 20', async () => {
    const advisorId = 13
    // activos = 20, negocio sin asignacion → limit = 20 → saturado
    cargaMock.mockResolvedValue(new Map([[advisorId, 20]]))
    negocioMock.mockResolvedValue({}) // no asignacion

    const db = fakeDb([
      { id: advisorId, tenant_id: 6, nombre: 'Felix', email: 'f@x.com', rol: 'asesor', activo: true, peso: 1, limite_activos: null },
    ])

    const lista = await listarUsuarios(6, db)
    expect(lista[0].saturado).toBe(true)
  })
})
