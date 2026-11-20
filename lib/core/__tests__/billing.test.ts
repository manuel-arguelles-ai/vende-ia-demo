import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Helper: mock fetch ───────────────────────────────────────────────────────

function makeFetch(responses: Record<string, unknown>) {
  return vi.fn().mockImplementation((url: string) => {
    const path = url.replace('https://api.mercadopago.com', '')
    // find matching key (exact or prefix)
    const key = Object.keys(responses).find(k => path.startsWith(k)) ?? path
    const body = responses[key] ?? {}
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    })
  })
}

// ─── Helper: mock db ──────────────────────────────────────────────────────────

type MockDbOpts = {
  billingConfig?: Record<string, string>   // plan → mp_preapproval_plan_id
  tenant?: { id: number; plan: string; estado: string; mp_preapproval_id?: string; sub_estado?: string; sub_actualizado?: string }
  pausedTenants?: { id: number; sub_actualizado: string }[]
  eventExists?: boolean
  upsertError?: string | null
  insertEventError?: string | null
  // Para buscar tenant por email (fallback webhook)
  usuarioByEmail?: { tenant_id: number } | null
}

function makeMockDb(opts: MockDbOpts = {}) {
  const {
    billingConfig = {},
    tenant = { id: 1, plan: 'pro', estado: 'activo', mp_preapproval_id: 'pa_123' },
    pausedTenants = [],
    eventExists = false,
    upsertError = null,
    insertEventError = null,
    usuarioByEmail = null,
  } = opts

  // Track calls for assertions
  const updateCalls: Array<{ table: string; data: unknown; filter: unknown }> = []
  const upsertCalls: Array<{ table: string; data: unknown }> = []
  const insertCalls: Array<{ table: string; data: unknown }> = []

  const from = vi.fn().mockImplementation((table: string) => {
    // ── billing_config ────────────────────────────────────────────────────────
    if (table === 'billing_config') {
      const upsert = vi.fn().mockImplementation((data: unknown) => {
        upsertCalls.push({ table, data })
        return {
          then: (resolve: (v: { data: null; error: null | { message: string } }) => unknown) =>
            Promise.resolve(resolve({ data: null, error: upsertError ? { message: upsertError } : null })),
        }
      })

      // select → .eq('plan', ...) → .single()
      const eqFn = vi.fn().mockImplementation((_col: string, val: string) => ({
        single: vi.fn().mockResolvedValue({
          data: billingConfig[val] ? { mp_preapproval_plan_id: billingConfig[val] } : null,
          error: billingConfig[val] ? null : { message: 'not found' },
        }),
      }))

      const select = vi.fn().mockReturnValue({ eq: eqFn })

      return { select, upsert }
    }

    // ── facturacion_eventos ───────────────────────────────────────────────────
    if (table === 'facturacion_eventos') {
      // .select().eq('mp_event_id', id).maybeSingle()
      const maybeSingle = vi.fn().mockResolvedValue({
        data: eventExists ? { id: 99 } : null,
        error: null,
      })
      const eqFn = vi.fn().mockReturnValue({ maybeSingle })
      const select = vi.fn().mockReturnValue({ eq: eqFn })

      // .insert(data)
      const insert = vi.fn().mockImplementation((data: unknown) => {
        insertCalls.push({ table, data })
        return {
          then: (resolve: (v: { data: null; error: null | { message: string } }) => unknown) =>
            Promise.resolve(resolve({ data: null, error: insertEventError ? { message: insertEventError } : null })),
        }
      })

      return { select, insert }
    }

    // ── usuarios ──────────────────────────────────────────────────────────────
    if (table === 'usuarios') {
      const maybeSingle = vi.fn().mockResolvedValue({
        data: usuarioByEmail,
        error: null,
      })
      const eqEmail = vi.fn().mockReturnValue({ maybeSingle })
      const select = vi.fn().mockReturnValue({ eq: eqEmail })
      return { select }
    }

    // ── tenants ───────────────────────────────────────────────────────────────
    if (table === 'tenants') {
      // .update(data).eq('id', id)
      const eqUpdate = vi.fn().mockImplementation((_col: string, id: unknown) => {
        return {
          then: (resolve: (v: { data: null; error: null }) => unknown) => {
            // find pending update
            const last = updateCalls[updateCalls.length - 1]
            if (last) last.filter = { id }
            return Promise.resolve(resolve({ data: null, error: null }))
          },
        }
      })
      const update = vi.fn().mockImplementation((data: unknown) => {
        updateCalls.push({ table, data, filter: null })
        return { eq: eqUpdate }
      })

      const selectTenantChain = vi.fn().mockImplementation((col: string, val: unknown) => {
        if (col === 'id') {
          return {
            maybeSingle: vi.fn().mockResolvedValue({ data: tenant, error: null }),
          }
        }
        if (col === 'mp_preapproval_id') {
          return {
            maybeSingle: vi.fn().mockResolvedValue({ data: tenant.mp_preapproval_id === val ? tenant : null, error: null }),
          }
        }
        if (col === 'sub_estado') {
          // For dunning: .eq('sub_estado','paused').lt('sub_actualizado',...)
          return {
            lt: vi.fn().mockReturnValue({
              then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
                Promise.resolve(resolve({ data: pausedTenants, error: null })),
            }),
          }
        }
        if (col === 'external_reference') {
          return {
            maybeSingle: vi.fn().mockResolvedValue({ data: tenant, error: null }),
          }
        }
        return {
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          lt: vi.fn().mockReturnValue({
            then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
              Promise.resolve(resolve({ data: [], error: null })),
          }),
        }
      })

      const select = vi.fn().mockReturnValue({ eq: selectTenantChain })

      return { select, update }
    }

    return {
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
    }
  })

  return {
    db: { from } as unknown as SupabaseClient,
    updateCalls,
    upsertCalls,
    insertCalls,
  }
}

// ─── Imports de producción (se cargan después de definir helpers) ─────────────

let crearSuscripcion: typeof import('../billing').crearSuscripcion
let procesarWebhook: typeof import('../billing').procesarWebhook
let aplicarDunning: typeof import('../billing').aplicarDunning
let cancelarSuscripcion: typeof import('../billing').cancelarSuscripcion
let crearPreapprovalPlan: typeof import('../billing').crearPreapprovalPlan

beforeEach(async () => {
  const mod = await import('../billing')
  crearSuscripcion = mod.crearSuscripcion
  procesarWebhook = mod.procesarWebhook
  aplicarDunning = mod.aplicarDunning
  cancelarSuscripcion = mod.cancelarSuscripcion
  crearPreapprovalPlan = mod.crearPreapprovalPlan
})

// ─── crearPreapprovalPlan ─────────────────────────────────────────────────────

describe('crearPreapprovalPlan', () => {
  it('postea a /preapproval_plan con auto_recurring y free_trial correctos', async () => {
    const { db, upsertCalls } = makeMockDb()
    const f = makeFetch({ '/preapproval_plan': { id: 'pp_pro_001' } })

    const id = await crearPreapprovalPlan('pro', { db, f })

    expect(id).toBe('pp_pro_001')
    // Verifica que se llamó a POST /preapproval_plan
    expect(f).toHaveBeenCalledOnce()
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.mercadopago.com/preapproval_plan')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.auto_recurring.transaction_amount).toBe(199)
    expect(body.auto_recurring.frequency_type).toBe('months')
    expect(body.auto_recurring.free_trial.frequency).toBe(7)
    expect(body.auto_recurring.free_trial.frequency_type).toBe('days')
    // Verifica que guardó en billing_config
    expect(upsertCalls).toHaveLength(1)
    expect((upsertCalls[0].data as { plan: string }).plan).toBe('pro')
    expect((upsertCalls[0].data as { mp_preapproval_plan_id: string }).mp_preapproval_plan_id).toBe('pp_pro_001')
  })
})

// ─── crearSuscripcion ─────────────────────────────────────────────────────────

describe('crearSuscripcion', () => {
  it('hace GET /preapproval_plan/{id} (NO POST /preapproval) para obtener init_point del plan', async () => {
    const { db } = makeMockDb({ billingConfig: { pro: 'pp_pro_001' } })
    const f = makeFetch({
      '/preapproval_plan/pp_pro_001': { id: 'pp_pro_001', init_point: 'https://mp/checkout?preapproval_plan_id=pp_pro_001' },
    })

    await crearSuscripcion(42, 'pro', 'cliente@example.com', db, f)

    expect(f).toHaveBeenCalledOnce()
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.mercadopago.com/preapproval_plan/pp_pro_001')
    // NO debe ser POST (es GET)
    expect(init?.method).toBeUndefined()
  })

  it('devuelve init_point del plan con external_reference=tenantId appended', async () => {
    const { db } = makeMockDb({ billingConfig: { pro: 'pp_pro_001' } })
    const f = makeFetch({
      '/preapproval_plan/pp_pro_001': { id: 'pp_pro_001', init_point: 'https://mp/checkout?preapproval_plan_id=pp_pro_001' },
    })

    const result = await crearSuscripcion(42, 'pro', 'cliente@example.com', db, f)

    // init_point ya tiene query → append con &
    expect(result.init_point).toBe('https://mp/checkout?preapproval_plan_id=pp_pro_001&external_reference=42')
    // preapproval_id vacío (no creamos preapproval todavía)
    expect(result.preapproval_id).toBe('')
  })

  it('append external_reference con ? cuando init_point no tiene query string', async () => {
    const { db } = makeMockDb({ billingConfig: { pro: 'pp_pro_001' } })
    const f = makeFetch({
      '/preapproval_plan/pp_pro_001': { id: 'pp_pro_001', init_point: 'https://mp/checkout' },
    })

    const result = await crearSuscripcion(7, 'pro', 'x@y.com', db, f)

    expect(result.init_point).toBe('https://mp/checkout?external_reference=7')
  })

  it('setea sub_estado=trial y trial_fin ~7 días en el futuro en el tenant', async () => {
    const { db, updateCalls } = makeMockDb({ billingConfig: { pro: 'pp_pro_001' } })
    const f = makeFetch({
      '/preapproval_plan/pp_pro_001': { id: 'pp_pro_001', init_point: 'https://mp/checkout?preapproval_plan_id=pp_pro_001' },
    })

    const antes = Date.now()
    await crearSuscripcion(42, 'pro', 'cliente@example.com', db, f)
    const despues = Date.now()

    // Debe haber llamado a update en tenants
    const tenantUpdate = updateCalls.find(c => c.table === 'tenants')
    expect(tenantUpdate).toBeTruthy()
    const data = tenantUpdate!.data as Record<string, string>
    expect(data.sub_estado).toBe('trial')
    // NO debe cambiar plan aún
    expect(data.plan).toBeUndefined()
    // NO debe setear mp_preapproval_id (no hay preapproval_id)
    expect(data.mp_preapproval_id).toBeUndefined()

    // trial_fin debe ser ~7 días en el futuro
    const trialFin = new Date(data.trial_fin).getTime()
    const siete_dias = 7 * 24 * 60 * 60 * 1000
    expect(trialFin).toBeGreaterThanOrEqual(antes + siete_dias - 1000)
    expect(trialFin).toBeLessThanOrEqual(despues + siete_dias + 1000)
  })
})

// ─── procesarWebhook ─────────────────────────────────────────────────────────

describe('procesarWebhook', () => {
  it('authorized con external_reference numérico → resuelve tenantId directo, actualiza estado=activo y sub_estado=authorized', async () => {
    const { db, updateCalls } = makeMockDb({
      tenant: { id: 7, plan: 'free', estado: 'activo', mp_preapproval_id: 'pa_123', sub_estado: 'trial' },
    })
    const f = makeFetch({
      '/preapproval/sub_abc': {
        id: 'sub_abc',
        status: 'authorized',
        external_reference: '7',
        payer_email: 'a@b.com',
      },
    })

    await procesarWebhook(
      { id: 'evt_001', type: 'subscription_preapproval', dataId: 'sub_abc' },
      db,
      f,
    )

    const tenantUpdate = updateCalls.find(c => c.table === 'tenants')
    expect(tenantUpdate).toBeTruthy()
    const data = tenantUpdate!.data as Record<string, string>
    expect(data.estado).toBe('activo')
    expect(data.sub_estado).toBe('authorized')
  })

  it('authorized sin external_reference → fallback por payer_email en usuarios', async () => {
    const { db, updateCalls } = makeMockDb({
      tenant: { id: 7, plan: 'free', estado: 'activo', mp_preapproval_id: 'pa_123', sub_estado: 'trial' },
      usuarioByEmail: { tenant_id: 7 },
    })
    const f = makeFetch({
      '/preapproval/sub_abc': {
        id: 'sub_abc',
        status: 'authorized',
        // sin external_reference
        payer_email: 'a@b.com',
      },
    })

    await procesarWebhook(
      { id: 'evt_fallback', type: 'subscription_preapproval', dataId: 'sub_abc' },
      db,
      f,
    )

    const tenantUpdate = updateCalls.find(c => c.table === 'tenants')
    expect(tenantUpdate).toBeTruthy()
    const data = tenantUpdate!.data as Record<string, string>
    expect(data.estado).toBe('activo')
    expect(data.sub_estado).toBe('authorized')
  })

  it('mismo event id dos veces → segunda llamada devuelve {duplicado:true} sin re-procesar', async () => {
    const { db } = makeMockDb({ eventExists: true })
    const f = makeFetch({})

    const result = await procesarWebhook(
      { id: 'evt_dup', type: 'subscription_preapproval', dataId: 'sub_abc' },
      db,
      f,
    )

    expect(result).toEqual({ duplicado: true })
    // No debería llamar a MP en absoluto
    expect(f).not.toHaveBeenCalled()
  })

  it('paused → sub_estado=paused y sub_actualizado en el tenant', async () => {
    const { db, updateCalls } = makeMockDb({
      tenant: { id: 1, plan: 'pro', estado: 'activo', mp_preapproval_id: 'pa_123', sub_estado: 'authorized' },
    })
    const f = makeFetch({
      '/preapproval/sub_abc': {
        id: 'sub_abc',
        status: 'paused',
        external_reference: '1',
      },
    })

    await procesarWebhook(
      { id: 'evt_002', type: 'subscription_preapproval', dataId: 'sub_abc' },
      db,
      f,
    )

    const tenantUpdate = updateCalls.find(c => c.table === 'tenants')
    expect(tenantUpdate).toBeTruthy()
    const data = tenantUpdate!.data as Record<string, string>
    expect(data.sub_estado).toBe('paused')
    expect(data.sub_actualizado).toBeTruthy()
  })

  it('registra el evento en facturacion_eventos', async () => {
    const { db, insertCalls } = makeMockDb({
      tenant: { id: 1, plan: 'pro', estado: 'activo', mp_preapproval_id: 'pa_123' },
    })
    const f = makeFetch({
      '/preapproval/sub_abc': {
        id: 'sub_abc',
        status: 'authorized',
        external_reference: '1',
      },
    })

    await procesarWebhook(
      { id: 'evt_003', type: 'subscription_preapproval', dataId: 'sub_abc' },
      db,
      f,
    )

    const evtInsert = insertCalls.find(c => c.table === 'facturacion_eventos')
    expect(evtInsert).toBeTruthy()
    const data = evtInsert!.data as Record<string, unknown>
    expect(data.mp_event_id).toBe('evt_003')
    expect(data.tipo).toBe('subscription_preapproval')
  })

  it('payment rejected → sub_estado=paused', async () => {
    const { db, updateCalls } = makeMockDb({
      tenant: { id: 1, plan: 'pro', estado: 'activo', mp_preapproval_id: 'pa_123', sub_estado: 'authorized' },
    })
    const f = makeFetch({
      '/authorized_payments/pay_001': {
        id: 'pay_001',
        status: 'rejected',
        external_reference: '1',
        preapproval_id: 'pa_123',
      },
    })

    await procesarWebhook(
      { id: 'evt_004', type: 'subscription_authorized_payment', dataId: 'pay_001' },
      db,
      f,
    )

    const tenantUpdate = updateCalls.find(c => c.table === 'tenants')
    expect(tenantUpdate).toBeTruthy()
    const data = tenantUpdate!.data as Record<string, string>
    expect(data.sub_estado).toBe('paused')
  })
})

// ─── cancelarSuscripcion ─────────────────────────────────────────────────────

describe('cancelarSuscripcion', () => {
  it('llama PUT /preapproval/{id} con status=cancelled y actualiza sub_estado en db', async () => {
    const { db, updateCalls } = makeMockDb({
      tenant: { id: 1, plan: 'pro', estado: 'activo', mp_preapproval_id: 'pa_123' },
    })
    const f = makeFetch({ '/preapproval/pa_123': { id: 'pa_123', status: 'cancelled' } })

    await cancelarSuscripcion(1, db, f)

    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.mercadopago.com/preapproval/pa_123')
    expect(init.method).toBe('PUT')
    const body = JSON.parse(init.body as string)
    expect(body.status).toBe('cancelled')

    const tenantUpdate = updateCalls.find(c => c.table === 'tenants')
    expect(tenantUpdate).toBeTruthy()
    const data = tenantUpdate!.data as Record<string, string>
    expect(data.sub_estado).toBe('cancelled')
  })
})

// ─── aplicarDunning ───────────────────────────────────────────────────────────

describe('aplicarDunning', () => {
  it('suspende tenant con sub_estado=paused y gracia vencida', async () => {
    const now = new Date()
    const haceUnaSemana = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { db, updateCalls } = makeMockDb({
      pausedTenants: [{ id: 5, sub_actualizado: haceUnaSemana }],
    })

    const count = await aplicarDunning(3, db)

    expect(count).toBe(1)
    // Debe haber llamado actualizarTenant con estado='suspendido'
    const tenantUpdate = updateCalls.find(c => c.table === 'tenants')
    expect(tenantUpdate).toBeTruthy()
    const data = tenantUpdate!.data as Record<string, string>
    expect(data.estado).toBe('suspendido')
  })

  it('no suspende tenant con sub_estado=paused pero dentro del período de gracia', async () => {
    const { db, updateCalls } = makeMockDb({
      pausedTenants: [], // la query con .lt() filtra → devuelve vacío
    })

    const count = await aplicarDunning(3, db)

    expect(count).toBe(0)
    expect(updateCalls).toHaveLength(0)
  })
})
