// lib/core/__tests__/gestion-usuarios.test.ts
import { describe, it, expect, vi } from 'vitest'
import { crearAsesor, listarUsuarios, actualizarUsuario } from '../usuarios'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock kpisPorAsesor/cargaPorAsesor/obtenerNegocio so the fakeDb only needs to
// handle usuarios and control_leads queries (avoids reentrance issues with the
// shared api object when concurrent calls overwrite tabla/filtros).
vi.mock('../motor-asignacion', () => ({
  kpisPorAsesor: vi.fn(async () => new Map()),
  cargaPorAsesor: vi.fn(async () => new Map()),
}))
vi.mock('../negocio', () => ({
  obtenerNegocio: vi.fn(async () => ({})),
}))

// Fake: usuarios + control_leads en memoria, scoped por tenant_id
function fakeDb(state: { usuarios: Record<string, unknown>[]; leads: Record<string, unknown>[] }, capt: Record<string, unknown> = {}) {
  let tabla = ''
  let filtroTenant: number | null = null
  let filtroId: number | null = null
  const api: Record<string, unknown> = {
    from(t: string) { tabla = t; filtroTenant = null; filtroId = null; return api },
    select() { return api },
    eq(col: string, v: number) { if (col === 'tenant_id') filtroTenant = v; if (col === 'id') filtroId = v; return api },
    insert(row: Record<string, unknown>) {
      capt.inserted = row
      const id = state.usuarios.length + 1
      state.usuarios.push({ id, ...row })
      return { select: () => ({ single: () => Promise.resolve({ data: { id }, error: null }) }) }
    },
    update(payload: Record<string, unknown>) { capt.updated = payload; return api },
    then(res: (v: unknown) => void) {
      // resolver lecturas
      if (tabla === 'usuarios') {
        const rows = state.usuarios.filter((u) => filtroTenant == null || u.tenant_id === filtroTenant)
        return Promise.resolve({ data: rows, error: null }).then(res)
      }
      if (tabla === 'control_leads') {
        const rows = state.leads.filter((l) => filtroTenant == null || l.tenant_id === filtroTenant)
        return Promise.resolve({ data: rows, error: null }).then(res)
      }
      return Promise.resolve({ data: [], error: null }).then(res)
    },
  }
  // update().eq().eq() devuelve promesa
  api.update = (payload: Record<string, unknown>) => { capt.updated = payload; const u: Record<string, unknown> = { eq: () => u, then: (r: (v: unknown) => void) => Promise.resolve({ error: null }).then(r) }; return u }
  return api as unknown as SupabaseClient
}

describe('gestión de usuarios', () => {
  it('crearAsesor inserta rol=asesor activo + scoped al tenant', async () => {
    const state = { usuarios: [] as Record<string, unknown>[], leads: [] as Record<string, unknown>[] }
    const capt: Record<string, unknown> = {}
    const r = await crearAsesor({ nombre: 'Ana', email: 'ana@x.com', password: 'secreto' }, 6, fakeDb(state, capt))
    expect(r.usuarioId).toBe(1)
    expect(capt.inserted).toMatchObject({ tenant_id: 6, email: 'ana@x.com', rol: 'asesor', nombre: 'Ana', activo: true })
    expect((capt.inserted as Record<string, unknown>).password_hash).toBeTypeOf('string')
  })
  it('listarUsuarios devuelve usuarios del tenant con conteo de leads asignados', async () => {
    const state = {
      usuarios: [
        { id: 1, tenant_id: 6, nombre: 'Ana', email: 'ana@x.com', rol: 'asesor', activo: true },
        { id: 2, tenant_id: 7, nombre: 'Otro', email: 'o@x.com', rol: 'asesor', activo: true },
      ],
      leads: [{ remitente: '51999', tenant_id: 6, asignado_a: 1 }, { remitente: '51888', tenant_id: 6, asignado_a: 1 }],
    }
    const lista = await listarUsuarios(6, fakeDb(state))
    expect(lista).toHaveLength(1)        // solo tenant 6
    expect(lista[0]).toMatchObject({ id: 1, nombre: 'Ana', leadsAsignados: 2 })
  })
  it('actualizarUsuario aplica cambios (scoped por tenant+id)', async () => {
    const state = { usuarios: [{ id: 1, tenant_id: 6, activo: true }], leads: [] }
    const capt: Record<string, unknown> = {}
    await actualizarUsuario(1, { activo: false, nombre: 'Ana B' }, 6, fakeDb(state, capt))
    expect(capt.updated).toMatchObject({ activo: false, nombre: 'Ana B' })
  })
})
