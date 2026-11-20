/**
 * Tests TDD para POST /api/login
 * Casos: éxito (cookie + 200), credenciales inválidas (401), rate limit (429),
 * falta AUTH_SECRET (401), body inválido (401).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/core/usuarios', () => ({
  verificarLogin: vi.fn(),
}))

vi.mock('@/lib/core/db', () => ({
  supabaseAdmin: vi.fn(() => ({})),
}))

// ─── Imports post-mock ────────────────────────────────────────────────────────

import { verificarLogin } from '@/lib/core/usuarios'
const mockVerificarLogin = vi.mocked(verificarLogin)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('POST /api/login', () => {
  const originalSecret = process.env.AUTH_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.AUTH_SECRET = 'test-secret-for-login-tests'
  })

  afterEach(() => {
    process.env.AUTH_SECRET = originalSecret
  })

  it('éxito: devuelve 200, { ok: true } y setea cookie vendeia_sesion HttpOnly', async () => {
    mockVerificarLogin.mockResolvedValueOnce({
      usuarioId: 5,
      tenantId: 2,
      rol: 'admin',
    })

    const { POST } = await import('../login/route')
    const res = await POST(makeRequest({ email: 'test@example.com', password: 'secure123' }))

    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('vendeia_sesion=')
    expect(setCookie).toContain('HttpOnly')
  })

  it('credenciales inválidas: devuelve 401 cuando verificarLogin retorna null', async () => {
    mockVerificarLogin.mockResolvedValueOnce(null)

    const { POST } = await import('../login/route')
    const res = await POST(makeRequest({ email: 'bad@example.com', password: 'wrong' }))

    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('credenciales inválidas')
  })

  it('falta AUTH_SECRET: devuelve 401', async () => {
    delete process.env.AUTH_SECRET

    const { POST } = await import('../login/route')
    const res = await POST(makeRequest({ email: 'a@b.com', password: 'x' }))

    expect(res.status).toBe(401)
    expect(mockVerificarLogin).not.toHaveBeenCalled()
  })

  it('email vacío: devuelve 401 sin llamar a verificarLogin', async () => {
    const { POST } = await import('../login/route')
    const res = await POST(makeRequest({ email: '   ', password: 'pass' }))

    expect(res.status).toBe(401)
    expect(mockVerificarLogin).not.toHaveBeenCalled()
  })

  it('body sin password: devuelve 401 sin llamar a verificarLogin', async () => {
    const { POST } = await import('../login/route')
    const res = await POST(makeRequest({ email: 'a@b.com' }))

    expect(res.status).toBe(401)
    expect(mockVerificarLogin).not.toHaveBeenCalled()
  })
})
