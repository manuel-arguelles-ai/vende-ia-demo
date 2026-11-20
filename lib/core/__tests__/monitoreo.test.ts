import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { saludCanales, resumenPlataforma } from '../monitoreo'
import type { TenantMetricas } from '../plataforma'

describe('saludCanales', () => {
  beforeEach(() => { process.env.WORKER_URL = 'http://worker-test' })
  afterEach(() => { delete process.env.WORKER_URL })

  it('sin WORKER_URL → workerCaido:true (no consulta)', async () => {
    delete process.env.WORKER_URL
    const fetchFn = vi.fn() as unknown as typeof fetch
    const r = await saludCanales(fetchFn)
    expect(r.workerCaido).toBe(true)
    expect(r.porTenant.size).toBe(0)
    expect((fetchFn as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0)
  })
  it('worker OK → mapa tenantId→connected', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ sesiones: [{ tenantId: 1, connected: true }, { tenantId: 6, connected: false }], uptime: 99 }) })) as unknown as typeof fetch
    const r = await saludCanales(fetchFn)
    expect(r.workerCaido).toBe(false)
    expect(r.porTenant.get(1)).toBe(true)
    expect(r.porTenant.get(6)).toBe(false)
  })
  it('worker caído (throw) → workerCaido:true, sin lanzar', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('ECONNREFUSED') }) as unknown as typeof fetch
    const r = await saludCanales(fetchFn)
    expect(r.workerCaido).toBe(true)
    expect(r.porTenant.size).toBe(0)
  })
})

function tm(over: Partial<TenantMetricas>): TenantMetricas {
  return { id: 1, nombre: 'T', slug: 't', estado: 'activo', plan: 'free', created_at: '', usuarios: 1, mensajes: 0, pedidos: 0, productos: 0, ultima_actividad: null, consumoMes: { mensajes: 0, tokens_llm: 0, segundos_voz: 0 }, limiteExcedido: false, cierres: 0, conversion: 0, canal: 'desconocido', ...over } as TenantMetricas
}

describe('resumenPlataforma', () => {
  it('agrega totales, por_plan, conectados, ingreso, excedidos', () => {
    const tenants = [
      tm({ id: 1, estado: 'activo', plan: 'pro', consumoMes: { mensajes: 500, tokens_llm: 10, segundos_voz: 5 }, pedidos: 4, cierres: 2, limiteExcedido: false }),
      tm({ id: 6, estado: 'activo', plan: 'free', consumoMes: { mensajes: 1000, tokens_llm: 0, segundos_voz: 0 }, pedidos: 1, cierres: 0, limiteExcedido: true }),
      tm({ id: 9, estado: 'suspendido', plan: 'free', consumoMes: { mensajes: 0, tokens_llm: 0, segundos_voz: 0 } }),
    ]
    const salud = { porTenant: new Map([[1, true], [6, false]]), workerCaido: false }
    const r = resumenPlataforma(tenants, salud)
    expect(r.tenants_total).toBe(3)
    expect(r.tenants_activos).toBe(2)
    expect(r.tenants_suspendidos).toBe(1)
    expect(r.por_plan).toMatchObject({ pro: 1, free: 2 })
    expect(r.mensajes_mes_total).toBe(1500)
    expect(r.limite_excedido_total).toBe(1)
    expect(r.cierres_total).toBe(2)
    expect(r.wa_conectados).toBe(1)   // tenant 1 conectado
    expect(r.wa_total).toBe(2)        // 1 y 6 reportados
    expect(r.ingreso_potencial_pen).toBe(199)  // 1 pro activo × 199
  })
})
