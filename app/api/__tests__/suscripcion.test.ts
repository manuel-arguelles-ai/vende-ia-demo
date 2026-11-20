/**
 * Tests TDD para /api/mp/webhook y /api/suscripcion
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/core/billing', () => ({
  procesarWebhook: vi.fn(),
  crearSuscripcion: vi.fn(),
  verificarFirmaMP: vi.fn(),
}))

vi.mock('@/lib/core/sesion-helper', () => ({
  tenantDeSesion: vi.fn(),
}))

vi.mock('@/lib/core/db', () => ({
  supabaseAdmin: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { email: 'test@example.com' }, error: null }),
    })),
  })),
}))

// ─── Imports post-mock ────────────────────────────────────────────────────────

import { procesarWebhook, crearSuscripcion, verificarFirmaMP } from '@/lib/core/billing'
import { tenantDeSesion } from '@/lib/core/sesion-helper'

const mockProcesarWebhook = vi.mocked(procesarWebhook)
const mockCrearSuscripcion = vi.mocked(crearSuscripcion)
const mockVerificarFirma = vi.mocked(verificarFirmaMP)
const mockSesion = vi.mocked(tenantDeSesion)

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SESION = { usuarioId: 7, tenantId: 42, rol: 'admin' as const }

function makeWebhookPost(body: unknown, query = ''): Request {
  return new Request(`http://localhost/api/mp/webhook${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeWebhookGet(query: string): Request {
  return new Request(`http://localhost/api/mp/webhook${query}`, { method: 'GET' })
}

function makeSuscripcionPost(body: unknown): Request {
  return new Request('http://localhost/api/suscripcion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── Suite webhook ────────────────────────────────────────────────────────────

describe('/api/mp/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    // Por defecto, firma válida (G añadió el gate HMAC); los casos felices asumen firma OK.
    mockVerificarFirma.mockReturnValue(true)
  })

  it('firma inválida → 401 y NO procesa el evento', async () => {
    mockVerificarFirma.mockReturnValue(false)

    const { POST } = await import('../mp/webhook/route')
    const req = makeWebhookPost({ type: 'subscription_preapproval', data: { id: 'd-1' }, id: 'evt-1' })
    const res = await POST(req)

    expect(res.status).toBe(401)
    expect(mockProcesarWebhook).not.toHaveBeenCalled()
  })

  it('POST con body {type, data:{id}} → llama procesarWebhook con id/type/dataId y responde 200', async () => {
    mockProcesarWebhook.mockResolvedValueOnce({})

    const { POST } = await import('../mp/webhook/route')
    const req = makeWebhookPost({ type: 'subscription_preapproval', data: { id: 'data-123' }, id: 'evt-abc' })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockProcesarWebhook).toHaveBeenCalledWith({
      id: 'evt-abc',
      type: 'subscription_preapproval',
      dataId: 'data-123',
    })
  })

  it('GET con query params type + data.id → llama procesarWebhook y responde 200', async () => {
    mockProcesarWebhook.mockResolvedValueOnce({})

    const { GET } = await import('../mp/webhook/route')
    const req = makeWebhookGet('?type=subscription_preapproval&data.id=data-456&id=evt-xyz')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockProcesarWebhook).toHaveBeenCalledWith({
      id: 'evt-xyz',
      type: 'subscription_preapproval',
      dataId: 'data-456',
    })
  })

  it('POST con topic en lugar de type → mapea a type en el evento', async () => {
    mockProcesarWebhook.mockResolvedValueOnce({})

    const { POST } = await import('../mp/webhook/route')
    const req = makeWebhookPost({ topic: 'preapproval', id: 'evt-t1', data: { id: 'd-1' } })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockProcesarWebhook).toHaveBeenCalledWith({
      id: 'evt-t1',
      type: 'preapproval',
      dataId: 'd-1',
    })
  })

  it('POST cuando procesarWebhook lanza error → igual responde 200 (robusto)', async () => {
    mockProcesarWebhook.mockRejectedValueOnce(new Error('MP explota'))

    const { POST } = await import('../mp/webhook/route')
    const req = makeWebhookPost({ type: 'subscription_preapproval', data: { id: 'd-1' }, id: 'evt-err' })
    const res = await POST(req)

    expect(res.status).toBe(200)
  })

  it('POST con payload raro/vacío → no rompe, responde 200', async () => {
    mockProcesarWebhook.mockResolvedValueOnce({})

    const { POST } = await import('../mp/webhook/route')
    const req = makeWebhookPost({})
    const res = await POST(req)

    expect(res.status).toBe(200)
  })
})

// ─── Suite suscripcion ────────────────────────────────────────────────────────

describe('/api/suscripcion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('POST sin sesión → 401', async () => {
    mockSesion.mockResolvedValueOnce(null)

    const { POST } = await import('../suscripcion/route')
    const res = await POST(makeSuscripcionPost({ plan: 'pro' }))

    expect(res.status).toBe(401)
    expect(mockCrearSuscripcion).not.toHaveBeenCalled()
  })

  it('POST plan "pro" con sesión → llama crearSuscripcion(tenantId, "pro", email) y devuelve {init_point}', async () => {
    mockSesion.mockResolvedValueOnce(SESION)
    mockCrearSuscripcion.mockResolvedValueOnce({
      init_point: 'https://mp.com/pay/abc',
      preapproval_id: 'pre-123',
    })

    const { POST } = await import('../suscripcion/route')
    const res = await POST(makeSuscripcionPost({ plan: 'pro' }))

    expect(res.status).toBe(200)
    expect(mockCrearSuscripcion).toHaveBeenCalledWith(42, 'pro', expect.any(String))
    const body = await res.json()
    expect(body.init_point).toBe('https://mp.com/pay/abc')
  })

  it('POST plan "max" con sesión → llama crearSuscripcion y devuelve init_point', async () => {
    mockSesion.mockResolvedValueOnce(SESION)
    mockCrearSuscripcion.mockResolvedValueOnce({
      init_point: 'https://mp.com/pay/max',
      preapproval_id: 'pre-456',
    })

    const { POST } = await import('../suscripcion/route')
    const res = await POST(makeSuscripcionPost({ plan: 'max' }))

    expect(res.status).toBe(200)
    expect(mockCrearSuscripcion).toHaveBeenCalledWith(42, 'max', expect.any(String))
    const body = await res.json()
    expect(body.init_point).toBe('https://mp.com/pay/max')
  })

  it('POST plan "free" → 400', async () => {
    mockSesion.mockResolvedValueOnce(SESION)

    const { POST } = await import('../suscripcion/route')
    const res = await POST(makeSuscripcionPost({ plan: 'free' }))

    expect(res.status).toBe(400)
    expect(mockCrearSuscripcion).not.toHaveBeenCalled()
  })

  it('POST plan inválido ("enterprise") → 400', async () => {
    mockSesion.mockResolvedValueOnce(SESION)

    const { POST } = await import('../suscripcion/route')
    const res = await POST(makeSuscripcionPost({ plan: 'enterprise' }))

    expect(res.status).toBe(400)
    expect(mockCrearSuscripcion).not.toHaveBeenCalled()
  })

  it('POST sin body plan → 400', async () => {
    mockSesion.mockResolvedValueOnce(SESION)

    const { POST } = await import('../suscripcion/route')
    const res = await POST(makeSuscripcionPost({}))

    expect(res.status).toBe(400)
    expect(mockCrearSuscripcion).not.toHaveBeenCalled()
  })
})
