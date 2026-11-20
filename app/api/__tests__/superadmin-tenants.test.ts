/**
 * Tests TDD para /api/superadmin/tenants y /api/superadmin/impersonar
 * - Sin sesión super-admin → 401 en todos los handlers
 * - Con sesión: GET→metricasTenants 200; POST válido→crearTenantConAdmin 200;
 *   POST sin nombre→400; PATCH {id,estado}→actualizarTenant 200; PATCH sin id→400
 * - impersonar {tenantId:5} → setea cookie vendeia_sesion con tenantId 5
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/superadmin-sesion', () => ({
  COOKIE_SUPERADMIN: 'vendeia_superadmin',
  superadminValido: vi.fn(),
}))

vi.mock('@/lib/core/plataforma', () => ({
  metricasTenants: vi.fn(),
  actualizarTenant: vi.fn(),
}))

vi.mock('@/lib/core/monitoreo', () => ({
  saludCanales: vi.fn().mockResolvedValue({ porTenant: new Map(), workerCaido: false }),
  resumenPlataforma: vi.fn().mockReturnValue({ tenants_total: 0 }),
}))

vi.mock('@/lib/core/usuarios', () => ({
  crearTenantConAdmin: vi.fn(),
}))

vi.mock('@/lib/core/eventos', () => ({
  eventosRecientes: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/sesion', () => ({
  firmarSesion: vi.fn(),
  COOKIE_SESION: 'vendeia_sesion',
  SESION_DIAS: 30,
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(() => undefined),
    })
  ),
}))

// ─── Imports post-mock ────────────────────────────────────────────────────────

import { superadminValido } from '@/lib/superadmin-sesion'
import { metricasTenants, actualizarTenant } from '@/lib/core/plataforma'
import { crearTenantConAdmin } from '@/lib/core/usuarios'
import { firmarSesion } from '@/lib/sesion'
import { cookies } from 'next/headers'

const mockSuperadminValido = vi.mocked(superadminValido)
const mockMetricasTenants = vi.mocked(metricasTenants)
const mockActualizarTenant = vi.mocked(actualizarTenant)
const mockCrearTenantConAdmin = vi.mocked(crearTenantConAdmin)
const mockFirmarSesion = vi.mocked(firmarSesion)
const mockCookies = vi.mocked(cookies)

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SUPERADMIN_PAYLOAD = { superadmin: true as const, email: 'admin@example.com' }

function makePost(body: unknown): Request {
  return new Request('http://localhost/api/superadmin/tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makePatch(body: unknown): Request {
  return new Request('http://localhost/api/superadmin/tenants', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makePostImpersonar(body: unknown): Request {
  return new Request('http://localhost/api/superadmin/impersonar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function setupSuperadminCookie(valor: string | undefined = 'token-valido') {
  mockCookies.mockResolvedValue({
    get: vi.fn((name: string) =>
      name === 'vendeia_superadmin' ? { name, value: valor ?? '' } : undefined
    ),
  } as unknown as Awaited<ReturnType<typeof cookies>>)
}

// ─── Suite: /api/superadmin/tenants ──────────────────────────────────────────

describe('/api/superadmin/tenants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.AUTH_SECRET = 'test-secret'
    process.env.SUPERADMIN_SECRET = 'superadmin-secret'

    // Por defecto sin cookie super-admin
    mockCookies.mockResolvedValue({
      get: vi.fn(() => undefined),
    } as unknown as Awaited<ReturnType<typeof cookies>>)
  })

  // ── GET ──────────────────────────────────────────────────────────────────

  it('GET sin sesión super-admin → 401', async () => {
    mockSuperadminValido.mockResolvedValueOnce(null)

    const { GET } = await import('../superadmin/tenants/route')
    const res = await GET()

    expect(res.status).toBe(401)
    expect(mockMetricasTenants).not.toHaveBeenCalled()
  })

  it('GET con sesión super-admin → llama metricasTenants y devuelve { tenants, resumen }', async () => {
    setupSuperadminCookie('token-valido')
    mockSuperadminValido.mockResolvedValueOnce(SUPERADMIN_PAYLOAD)
    mockMetricasTenants.mockResolvedValueOnce([
      {
        id: 1,
        nombre: 'Tenant A',
        slug: 'tenant-a',
        estado: 'activo',
        plan: 'free',
        created_at: '2026-01-01T00:00:00Z',
        usuarios: 2,
        mensajes: 100,
        pedidos: 5,
        productos: 10,
        ultima_actividad: null,
        consumoMes: { mensajes: 0, tokens_llm: 0, segundos_voz: 0 },
        limiteExcedido: false,
        cierres: 0,
        conversion: 0,
        canal: 'desconocido' as const,
        ventana_turnos: null,
      },
    ])

    const { GET } = await import('../superadmin/tenants/route')
    const res = await GET()

    expect(res.status).toBe(200)
    expect(mockMetricasTenants).toHaveBeenCalledOnce()
    const body = await res.json()
    expect(Array.isArray(body.tenants)).toBe(true)
    expect(body.tenants[0].nombre).toBe('Tenant A')
    expect(body.resumen).toBeDefined()
  })

  // ── POST ─────────────────────────────────────────────────────────────────

  it('POST sin sesión super-admin → 401', async () => {
    mockSuperadminValido.mockResolvedValueOnce(null)

    const { POST } = await import('../superadmin/tenants/route')
    const res = await POST(makePost({ nombre: 'Test', rubro: 'retail', email: 'a@b.com', password: 'pass' }))

    expect(res.status).toBe(401)
    expect(mockCrearTenantConAdmin).not.toHaveBeenCalled()
  })

  it('POST con sesión y datos válidos → llama crearTenantConAdmin y devuelve 200', async () => {
    setupSuperadminCookie('token-valido')
    mockSuperadminValido.mockResolvedValueOnce(SUPERADMIN_PAYLOAD)
    mockCrearTenantConAdmin.mockResolvedValueOnce({
      tenantId: 10,
      usuarioId: 99,
      widgetKey: 'wk_xyz',
    })

    const { POST } = await import('../superadmin/tenants/route')
    const res = await POST(makePost({ nombre: 'Nuevo Tenant', rubro: 'food', email: 'nuevo@b.com', password: 'pass123' }))

    expect(res.status).toBe(200)
    expect(mockCrearTenantConAdmin).toHaveBeenCalledWith({
      nombre: 'Nuevo Tenant',
      rubro: 'food',
      email: 'nuevo@b.com',
      password: 'pass123',
    })
    const body = await res.json()
    expect(body.tenantId).toBe(10)
    expect(body.widgetKey).toBe('wk_xyz')
  })

  it('POST con sesión pero sin nombre → 400 sin llamar crearTenantConAdmin', async () => {
    setupSuperadminCookie('token-valido')
    mockSuperadminValido.mockResolvedValueOnce(SUPERADMIN_PAYLOAD)

    const { POST } = await import('../superadmin/tenants/route')
    const res = await POST(makePost({ rubro: 'food', email: 'a@b.com', password: 'pass' }))

    expect(res.status).toBe(400)
    expect(mockCrearTenantConAdmin).not.toHaveBeenCalled()
  })

  it('POST con email duplicado → 409', async () => {
    setupSuperadminCookie('token-valido')
    mockSuperadminValido.mockResolvedValueOnce(SUPERADMIN_PAYLOAD)
    mockCrearTenantConAdmin.mockRejectedValueOnce(new Error('EMAIL_DUPLICATE: el email ya está registrado'))

    const { POST } = await import('../superadmin/tenants/route')
    const res = await POST(makePost({ nombre: 'Dup', rubro: 'food', email: 'dup@b.com', password: 'pass' }))

    expect(res.status).toBe(409)
  })

  // ── PATCH ────────────────────────────────────────────────────────────────

  it('PATCH sin sesión super-admin → 401', async () => {
    mockSuperadminValido.mockResolvedValueOnce(null)

    const { PATCH } = await import('../superadmin/tenants/route')
    const res = await PATCH(makePatch({ id: 1, estado: 'suspendido' }))

    expect(res.status).toBe(401)
    expect(mockActualizarTenant).not.toHaveBeenCalled()
  })

  it('PATCH con sesión y {id, estado} → llama actualizarTenant y devuelve 200', async () => {
    setupSuperadminCookie('token-valido')
    mockSuperadminValido.mockResolvedValueOnce(SUPERADMIN_PAYLOAD)
    mockActualizarTenant.mockResolvedValueOnce(undefined)

    const { PATCH } = await import('../superadmin/tenants/route')
    const res = await PATCH(makePatch({ id: 1, estado: 'suspendido' }))

    expect(res.status).toBe(200)
    expect(mockActualizarTenant).toHaveBeenCalledWith(1, { estado: 'suspendido', plan: undefined })
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it('PATCH sin id → 400 sin llamar actualizarTenant', async () => {
    setupSuperadminCookie('token-valido')
    mockSuperadminValido.mockResolvedValueOnce(SUPERADMIN_PAYLOAD)

    const { PATCH } = await import('../superadmin/tenants/route')
    const res = await PATCH(makePatch({ estado: 'suspendido' }))

    expect(res.status).toBe(400)
    expect(mockActualizarTenant).not.toHaveBeenCalled()
  })
})

// ─── Suite: /api/superadmin/impersonar ───────────────────────────────────────

describe('/api/superadmin/impersonar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.AUTH_SECRET = 'test-secret'
    process.env.SUPERADMIN_SECRET = 'superadmin-secret'

    mockCookies.mockResolvedValue({
      get: vi.fn(() => undefined),
    } as unknown as Awaited<ReturnType<typeof cookies>>)
  })

  it('POST sin sesión super-admin → 401', async () => {
    mockSuperadminValido.mockResolvedValueOnce(null)

    const { POST } = await import('../superadmin/impersonar/route')
    const res = await POST(makePostImpersonar({ tenantId: 5 }))

    expect(res.status).toBe(401)
    expect(mockFirmarSesion).not.toHaveBeenCalled()
  })

  it('POST sin tenantId → 400', async () => {
    setupSuperadminCookie('token-valido')
    mockSuperadminValido.mockResolvedValueOnce(SUPERADMIN_PAYLOAD)

    const { POST } = await import('../superadmin/impersonar/route')
    const res = await POST(makePostImpersonar({}))

    expect(res.status).toBe(400)
    expect(mockFirmarSesion).not.toHaveBeenCalled()
  })

  it('POST {tenantId:5} con sesión → setea cookie vendeia_sesion con tenantId 5 y devuelve 200', async () => {
    setupSuperadminCookie('token-valido')
    mockSuperadminValido.mockResolvedValueOnce(SUPERADMIN_PAYLOAD)
    mockFirmarSesion.mockResolvedValueOnce('sesion-firmada-token')

    const { POST } = await import('../superadmin/impersonar/route')
    const res = await POST(makePostImpersonar({ tenantId: 5 }))

    expect(res.status).toBe(200)
    expect(mockFirmarSesion).toHaveBeenCalledWith(
      { usuarioId: 0, tenantId: 5, rol: 'admin' },
      expect.any(String),
    )

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('vendeia_sesion=')
    expect(setCookie).toContain('HttpOnly')

    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })
})
