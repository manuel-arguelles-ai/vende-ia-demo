import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Mock only the external dependencies of motor-eleccion.ts and motor-asignacion.ts
// Do NOT mock motor-asignacion itself — we drive the real cargaPorAsesor via fakeDb
// ---------------------------------------------------------------------------
const negocio: { asignacion?: { regla: string; limite_default: number; ultimo_asesor_id: number | null } } = {
  asignacion: { regla: 'round_robin', limite_default: 5, ultimo_asesor_id: null },
}
const asignados: { remitente: string; usuarioId: number | null }[] = []

vi.mock('../negocio', () => ({
  obtenerNegocio: vi.fn(async () => negocio),
  guardarNegocio: vi.fn(async (d: { asignacion?: { ultimo_asesor_id: number | null } }) => {
    if (d.asignacion) negocio.asignacion!.ultimo_asesor_id = d.asignacion.ultimo_asesor_id
  }),
}))
vi.mock('../asignacion', () => ({
  asignarLead: vi.fn(async (r: string, u: number | null) => { asignados.push({ remitente: r, usuarioId: u }) }),
}))
// Mock gestion so cierresPorRemitente returns an empty map by default (no closed leads)
// Individual tests that need closed leads can override via the mock return value
import { cierresPorRemitente } from '../gestion'
vi.mock('../gestion', () => ({
  cierresPorRemitente: vi.fn(async () => new Map()),
}))

// ---------------------------------------------------------------------------
// Fake DB factory
// Builds a Supabase-like query builder that branches by table name.
//   - 'usuarios': returns `userRows` (advisor list)
//   - 'control_leads': returns `leadRows` for list queries; returns `yaAsignadoRow`
//     for the .maybeSingle() lookup in asignarNuevoLead
// The builder is fully chainable (all methods return itself) so it survives
// scoped()'s .select().eq('tenant_id', n) wrapping and further .eq()/.not() calls.
// ---------------------------------------------------------------------------
type UserRow = { id: number; peso: number; limite_activos: number | null; rol: string; activo: boolean }
type LeadRow = { remitente: string; asignado_a: number }

function buildFakeDb(
  userRows: UserRow[],
  leadRows: LeadRow[],
  yaAsignadoId: number | null = null,
): SupabaseClient {
  let currentTable = ''

  const api: Record<string, unknown> = {
    from(t: string) {
      currentTable = t
      return api
    },
    select() { return api },
    eq() { return api },
    not() { return api },
    order() { return api },
    limit() { return api },
    single() { return Promise.resolve({ data: null, error: null }) },
    maybeSingle() {
      if (currentTable === 'control_leads') {
        return Promise.resolve({
          data: yaAsignadoId != null ? { asignado_a: yaAsignadoId } : null,
          error: null,
        })
      }
      return Promise.resolve({ data: null, error: null })
    },
    then(res: (v: { data: unknown; error: null }) => void, rej?: (e: unknown) => void) {
      let data: unknown
      if (currentTable === 'usuarios') {
        data = userRows
      } else if (currentTable === 'control_leads') {
        data = leadRows
      } else {
        data = []
      }
      return Promise.resolve({ data, error: null }).then(res, rej)
    },
  }
  return api as unknown as SupabaseClient
}

// Default 3 advisors (no per-test weight/limit overrides needed for most tests)
const DEFAULT_USERS: UserRow[] = [
  { id: 1, peso: 1, limite_activos: null, rol: 'asesor', activo: true },
  { id: 2, peso: 1, limite_activos: null, rol: 'asesor', activo: true },
  { id: 3, peso: 1, limite_activos: null, rol: 'asesor', activo: true },
]

// Helper: build lead rows for a given load map {advisorId: count}
// Uses synthetic remitente keys like "r_A_N" (advisor A, lead N) so they're unique
function leadsForLoads(loads: Record<number, number>): LeadRow[] {
  const rows: LeadRow[] = []
  for (const [advisorId, count] of Object.entries(loads)) {
    for (let i = 0; i < count; i++) {
      rows.push({ remitente: `r_${advisorId}_${i}`, asignado_a: Number(advisorId) })
    }
  }
  return rows
}

import { elegirAsesor, asignarNuevoLead } from '../motor-asignacion'

// ---------------------------------------------------------------------------
describe('elegirAsesor', () => {
  beforeEach(() => {
    // Reset cierresPorRemitente to empty map between tests
    vi.mocked(cierresPorRemitente).mockResolvedValue(new Map())
  })

  it('off → null', async () => {
    negocio.asignacion = { regla: 'off', limite_default: 5, ultimo_asesor_id: null }
    const db = buildFakeDb(DEFAULT_USERS, [])
    expect(await elegirAsesor(6, db)).toBeNull()
  })

  it('carga → el menos cargado', async () => {
    negocio.asignacion = { regla: 'carga', limite_default: 5, ultimo_asesor_id: null }
    // Loads: {1:3, 2:1, 3:5} — advisor 2 has the lowest load
    const db = buildFakeDb(DEFAULT_USERS, leadsForLoads({ 1: 3, 2: 1, 3: 5 }))
    expect(await elegirAsesor(6, db)).toBe(2)
  })

  it('round_robin → rota desde ultimo_asesor_id', async () => {
    negocio.asignacion = { regla: 'round_robin', limite_default: 5, ultimo_asesor_id: 1 }
    const db1 = buildFakeDb(DEFAULT_USERS, [])
    expect(await elegirAsesor(6, db1)).toBe(2)   // siguiente tras 1
    negocio.asignacion = { regla: 'round_robin', limite_default: 5, ultimo_asesor_id: 3 }
    const db2 = buildFakeDb(DEFAULT_USERS, [])
    expect(await elegirAsesor(6, db2)).toBe(1)   // wrap-around
  })

  it('saturación: descarta a los que llegaron al límite', async () => {
    // limite_default=3; loads {1:3, 2:3, 3:1} → 1 and 2 are saturated, 3 is elegible
    negocio.asignacion = { regla: 'carga', limite_default: 3, ultimo_asesor_id: null }
    const db = buildFakeDb(DEFAULT_USERS, leadsForLoads({ 1: 3, 2: 3, 3: 1 }))
    expect(await elegirAsesor(6, db)).toBe(3)
  })

  it('todos saturados → el menos cargado igual (no null)', async () => {
    // limite_default=2; loads {1:5, 2:3, 3:4} → all saturated → fallback to least loaded = 2
    negocio.asignacion = { regla: 'carga', limite_default: 2, ultimo_asesor_id: null }
    const db = buildFakeDb(DEFAULT_USERS, leadsForLoads({ 1: 5, 2: 3, 3: 4 }))
    expect(await elegirAsesor(6, db)).toBe(2)
  })
})

// ---------------------------------------------------------------------------
describe('asignarNuevoLead', () => {
  beforeEach(() => {
    asignados.length = 0
    vi.mocked(cierresPorRemitente).mockResolvedValue(new Map())
  })

  it('no reasigna un lead ya asignado', async () => {
    negocio.asignacion = { regla: 'round_robin', limite_default: 5, ultimo_asesor_id: null }
    // yaAsignadoId=9 → maybeSingle returns {asignado_a: 9}
    const db = buildFakeDb(DEFAULT_USERS, [], 9)
    const r = await asignarNuevoLead('rX', 6, db)
    expect(r).toBe(9)
    expect(asignados).toHaveLength(0)
  })

  it('asigna y persiste ultimo_asesor_id', async () => {
    negocio.asignacion = { regla: 'carga', limite_default: 5, ultimo_asesor_id: null }
    // Loads: {1:0, 2:2, 3:1} — advisor 1 has load 0 (lowest)
    // yaAsignadoId=null → not yet assigned
    const db = buildFakeDb(DEFAULT_USERS, leadsForLoads({ 2: 2, 3: 1 }), null)
    const r = await asignarNuevoLead('rY', 6, db)
    expect(r).toBe(1)
    expect(asignados).toEqual([{ remitente: 'rY', usuarioId: 1 }])
    expect(negocio.asignacion!.ultimo_asesor_id).toBe(1)
  })
})
