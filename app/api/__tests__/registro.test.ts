/**
 * Tests TDD para POST /api/registro
 * Casos: éxito, email duplicado, campo faltante, parser CSV con comas en comillas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/core/usuarios', () => ({
  crearTenantConAdmin: vi.fn(),
}))

vi.mock('@/lib/core/db', () => ({
  supabaseAdmin: vi.fn(() => ({})),
}))

vi.mock('@/lib/core/embeddings', () => ({
  embeberDocumento: vi.fn(() => Promise.resolve(null)),
  embeberQuery: vi.fn(() => Promise.resolve(null)),
}))

// Mock next/headers para el route de importar (cookies)
vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(() => undefined),
    })
  ),
}))

// ─── Imports post-mock ────────────────────────────────────────────────────────

import { crearTenantConAdmin } from '@/lib/core/usuarios'
const mockCrearTenant = vi.mocked(crearTenantConAdmin)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/registro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── Suite principal ──────────────────────────────────────────────────────────

describe('POST /api/registro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.AUTH_SECRET = 'test-secret-for-tests'
  })

  it('éxito: devuelve 200 con widget_key y setea cookie de sesión', async () => {
    mockCrearTenant.mockResolvedValueOnce({
      tenantId: 7,
      usuarioId: 42,
      widgetKey: 'wk_abc123',
    })

    const { POST } = await import('../registro/route')
    const res = await POST(makeRequest({ nombre: 'Mi Tienda', rubro: 'retail', email: 'a@b.com', password: 'pass123' }))

    expect(res.status).toBe(200)
    const body = await res.json() as { widget_key: string }
    expect(body.widget_key).toBe('wk_abc123')

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('vendeia_sesion=')
    expect(setCookie).toContain('HttpOnly')
  })

  it('email duplicado: devuelve 409 con mensaje adecuado', async () => {
    mockCrearTenant.mockRejectedValueOnce(new Error('EMAIL_DUPLICATE: el email a@b.com ya está registrado'))

    const { POST } = await import('../registro/route')
    const res = await POST(makeRequest({ nombre: 'Otra', rubro: 'food', email: 'a@b.com', password: 'x' }))

    expect(res.status).toBe(409)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('email ya registrado')
  })

  it('campo faltante: devuelve 400', async () => {
    const { POST } = await import('../registro/route')
    const res = await POST(makeRequest({ nombre: 'Solo nombre' }))

    expect(res.status).toBe(400)
    expect(mockCrearTenant).not.toHaveBeenCalled()
  })

  it('campo vacío (string vacío): devuelve 400', async () => {
    const { POST } = await import('../registro/route')
    const res = await POST(makeRequest({ nombre: '', rubro: 'food', email: 'x@x.com', password: 'p' }))

    expect(res.status).toBe(400)
  })
})

// Parser CSV tests moved to catalogo-importar-parser.test.ts to avoid cold-suite
// timeout caused by the importar route pulling in Next.js cookies/headers.
