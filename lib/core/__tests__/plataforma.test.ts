import { describe, it, expect, vi } from 'vitest'
import { metricasTenants, actualizarTenant, tenantActivo, obtenerVentanaTurnos, PLANES } from '../plataforma'
import type { PlanKey } from '../plataforma'
import type { SupabaseClient } from '@supabase/supabase-js'

// Builder de mock db encadenable para consultas service_role (cross-tenant, sin scoped).
// Soporta .from().select().eq().single() / .maybeSingle() / .order() / .limit()
// y también .from().update().eq() y .from().select('x',{count,head}).eq().then()
function makeMockDb(overrides: {
  tenants?: unknown[]
  usuariosCount?: number
  mensajesCount?: number
  pedidosCount?: number
  productosCount?: number
  mensajesRows?: { created_at: string; tenant_id: number }[]
  tenantRow?: { estado: string } | null
  updateError?: { message: string } | null
} = {}) {
  const {
    tenants = [],
    usuariosCount = 0,
    mensajesCount = 0,
    pedidosCount = 0,
    productosCount = 0,
    mensajesRows = [],
    tenantRow = { estado: 'activo' },
    updateError = null,
  } = overrides

  // Registra llamadas a update para verificar en tests
  const updateCalls: Array<{ obj: unknown; id: unknown }> = []

  function makeChain(result: { data: unknown; error: unknown; count?: number | null }) {
    const chain: Record<string, unknown> = {}
    chain.then = (resolve: (v: typeof result) => unknown) => Promise.resolve(resolve(result))
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.order = vi.fn().mockReturnValue(chain)
    chain.limit = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockResolvedValue(result)
    chain.maybeSingle = vi.fn().mockResolvedValue(result)
    return chain
  }

  const from = vi.fn().mockImplementation((table: string) => {
    // update path
    const updateChain = {
      eq: vi.fn().mockImplementation((_col: string, id: unknown) => {
        return {
          then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => {
            updateCalls.push({ obj: updateChain._obj, id })
            return Promise.resolve(resolve({ data: null, error: updateError }))
          },
        }
      }),
      _obj: null as unknown,
    }

    const update = vi.fn().mockImplementation((obj: unknown) => {
      updateChain._obj = obj
      return updateChain
    })

    // select path por tabla
    const select = vi.fn().mockImplementation((_cols: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.count === 'exact' && opts?.head) {
        // conteo por tabla
        const countMap: Record<string, number> = {
          usuarios: usuariosCount,
          mensajes: mensajesCount,
          pedidos: pedidosCount,
          productos: productosCount,
        }
        const count = countMap[table] ?? 0
        return makeChain({ data: null, error: null, count })
      }

      // select de tenants
      if (table === 'tenants') {
        return makeChain({ data: tenants, error: null })
      }

      // select estado de tenant (tenantActivo)
      if (table === 'tenants') {
        return makeChain({ data: tenantRow, error: null })
      }

      // select created_at de mensajes para ultima_actividad
      if (table === 'mensajes') {
        return makeChain({ data: mensajesRows, error: null })
      }

      return makeChain({ data: [], error: null })
    })

    return { select, update, eq: updateChain.eq }
  })

  return {
    db: { from } as unknown as SupabaseClient,
    from,
    updateCalls,
  }
}

// ─── PLANES ──────────────────────────────────────────────────────────────────

describe('PLANES', () => {
  it('tiene free con mensajes_mes=1000', () => {
    expect(PLANES.free.nombre).toBe('Free')
    expect(PLANES.free.limites.mensajes_mes).toBe(1000)
  })

  it('tiene pro con mensajes_mes=20000', () => {
    expect(PLANES.pro.nombre).toBe('Pro')
    expect(PLANES.pro.limites.mensajes_mes).toBe(20000)
  })

  // ── nuevos campos billing ──────────────────────────────────────────────────

  it('free tiene precio_pen=0 y pago=false', () => {
    expect(PLANES.free.precio_pen).toBe(0)
    expect(PLANES.free.pago).toBe(false)
  })

  it('pro tiene precio_pen=199 y pago=true', () => {
    expect(PLANES.pro.precio_pen).toBe(199)
    expect(PLANES.pro.pago).toBe(true)
  })

  it('max existe con precio_pen=599 y pago=true', () => {
    expect(PLANES.max.nombre).toBe('Max')
    expect(PLANES.max.precio_pen).toBe(599)
    expect(PLANES.max.pago).toBe(true)
  })

  it('enterprise existe con precio_pen=0, pago=false y contacto=true', () => {
    expect(PLANES.enterprise.nombre).toBe('Enterprise')
    expect(PLANES.enterprise.precio_pen).toBe(0)
    expect(PLANES.enterprise.pago).toBe(false)
    expect(PLANES.enterprise.contacto).toBe(true)
  })

  it('PLANES exporta tipo PlanKey con los 4 planes', () => {
    const llaves = Object.keys(PLANES) as PlanKey[]
    expect(llaves).toContain('free')
    expect(llaves).toContain('pro')
    expect(llaves).toContain('max')
    expect(llaves).toContain('enterprise')
  })
})

// ─── metricasTenants ─────────────────────────────────────────────────────────

describe('metricasTenants', () => {
  it('devuelve array vacío cuando no hay tenants', async () => {
    const { db } = makeMockDb({ tenants: [] })
    const result = await metricasTenants(db)
    expect(result).toEqual([])
  })

  it('arma TenantMetricas para un tenant con todos los counts', async () => {
    const tenant = {
      id: 1,
      nombre: 'Tienda Demo',
      slug: 'tienda-demo',
      estado: 'activo',
      plan: 'free',
      created_at: '2024-01-01T00:00:00Z',
    }
    const mensajesRows = [
      { created_at: '2024-06-01T10:00:00Z', tenant_id: 1 },
      { created_at: '2024-05-15T08:00:00Z', tenant_id: 1 },
    ]
    const { db } = makeMockDb({
      tenants: [tenant],
      usuariosCount: 3,
      mensajesCount: 150,
      pedidosCount: 42,
      productosCount: 20,
      mensajesRows,
    })
    const result = await metricasTenants(db)
    expect(result).toHaveLength(1)
    const t = result[0]
    expect(t.id).toBe(1)
    expect(t.nombre).toBe('Tienda Demo')
    expect(t.slug).toBe('tienda-demo')
    expect(t.estado).toBe('activo')
    expect(t.plan).toBe('free')
    expect(t.created_at).toBe('2024-01-01T00:00:00Z')
    expect(t.usuarios).toBe(3)
    expect(t.mensajes).toBe(150)
    expect(t.pedidos).toBe(42)
    expect(t.productos).toBe(20)
    expect(t.ultima_actividad).toBe('2024-06-01T10:00:00Z')
  })

  it('ultima_actividad es null cuando no hay mensajes', async () => {
    const tenant = {
      id: 2,
      nombre: 'Otra Tienda',
      slug: 'otra-tienda',
      estado: 'activo',
      plan: 'pro',
      created_at: '2024-02-01T00:00:00Z',
    }
    const { db } = makeMockDb({ tenants: [tenant], mensajesRows: [] })
    const result = await metricasTenants(db)
    expect(result[0].ultima_actividad).toBeNull()
  })

  it('maneja dos tenants y los retorna en orden', async () => {
    const t1 = { id: 1, nombre: 'A', slug: 'a', estado: 'activo', plan: 'free', created_at: '2024-01-01T00:00:00Z' }
    const t2 = { id: 2, nombre: 'B', slug: 'b', estado: 'suspendido', plan: 'pro', created_at: '2024-02-01T00:00:00Z' }
    const { db } = makeMockDb({ tenants: [t1, t2] })
    const result = await metricasTenants(db)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe(1)
    expect(result[1].id).toBe(2)
  })
})

// ─── actualizarTenant ─────────────────────────────────────────────────────────

describe('actualizarTenant', () => {
  it('rechaza estado inválido', async () => {
    const { db } = makeMockDb()
    await expect(actualizarTenant(1, { estado: 'bloqueado' }, db)).rejects.toThrow()
  })

  it('acepta estado=activo', async () => {
    const { db } = makeMockDb()
    await expect(actualizarTenant(1, { estado: 'activo' }, db)).resolves.toBeUndefined()
  })

  it('acepta estado=suspendido', async () => {
    const { db } = makeMockDb()
    await expect(actualizarTenant(1, { estado: 'suspendido' }, db)).resolves.toBeUndefined()
  })

  it('solo envía campos permitidos (estado y plan)', async () => {
    const { db, updateCalls } = makeMockDb()
    await actualizarTenant(5, { estado: 'activo', plan: 'pro' }, db)
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0].obj).toEqual({ estado: 'activo', plan: 'pro' })
    expect(updateCalls[0].id).toBe(5)
  })

  it('no llama a update cuando no hay campos válidos', async () => {
    const { db, from } = makeMockDb()
    // campos vacío → no debe llamar update
    await expect(actualizarTenant(1, {}, db)).rejects.toThrow()
    expect(from).not.toHaveBeenCalled()
  })

  it('lanza error cuando supabase devuelve error', async () => {
    const { db } = makeMockDb({ updateError: { message: 'db error' } })
    await expect(actualizarTenant(1, { estado: 'activo' }, db)).rejects.toThrow('db error')
  })

  it('ventana_turnos: número válido se guarda', async () => {
    const { db, updateCalls } = makeMockDb()
    await actualizarTenant(5, { ventana_turnos: 30 }, db)
    expect(updateCalls[0].obj).toEqual({ ventana_turnos: 30 })
  })

  it('ventana_turnos: clamp a [6, 60]', async () => {
    const a = makeMockDb(); await actualizarTenant(5, { ventana_turnos: 100 }, a.db)
    expect(a.updateCalls[0].obj).toEqual({ ventana_turnos: 60 })
    const b = makeMockDb(); await actualizarTenant(5, { ventana_turnos: 2 }, b.db)
    expect(b.updateCalls[0].obj).toEqual({ ventana_turnos: 6 })
  })

  it('ventana_turnos: null vuelve al default', async () => {
    const { db, updateCalls } = makeMockDb()
    await actualizarTenant(5, { ventana_turnos: null }, db)
    expect(updateCalls[0].obj).toEqual({ ventana_turnos: null })
  })
})

// ─── obtenerVentanaTurnos ──────────────────────────────────────────────────────

describe('obtenerVentanaTurnos', () => {
  const mock = (ventana_turnos: number | null) => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { ventana_turnos }, error: null }) }),
      }),
    }),
  }) as never
  it('null → default 20', async () => { expect(await obtenerVentanaTurnos(1, mock(null))).toBe(20) })
  it('valor configurado se usa', async () => { expect(await obtenerVentanaTurnos(1, mock(35))).toBe(35) })
  it('clamp al rango', async () => { expect(await obtenerVentanaTurnos(1, mock(999))).toBe(60) })
})

// ─── tenantActivo ─────────────────────────────────────────────────────────────

describe('tenantActivo', () => {
  it('retorna false cuando estado=suspendido', async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { estado: 'suspendido' }, error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient
    expect(await tenantActivo(1, mockDb)).toBe(false)
  })

  it('retorna true cuando estado=activo', async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { estado: 'activo' }, error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient
    expect(await tenantActivo(1, mockDb)).toBe(true)
  })

  it('retorna true cuando el tenant no existe (fila null)', async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient
    expect(await tenantActivo(99, mockDb)).toBe(true)
  })

  it('retorna true cuando hay error de db (fail-open)', async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'conn error' } }),
          }),
        }),
      }),
    } as unknown as SupabaseClient
    expect(await tenantActivo(1, mockDb)).toBe(true)
  })
})
