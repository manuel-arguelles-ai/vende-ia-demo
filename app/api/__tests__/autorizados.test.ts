/**
 * Tests TDD para /api/autorizados
 * GET → listar, POST → agregar, DELETE → quitar, sin sesión → 401, POST sin numero → 400
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/core/allowlist', () => ({
  listarAutorizados: vi.fn(),
  agregarAutorizado: vi.fn(),
  quitarAutorizado: vi.fn(),
}))

vi.mock('@/lib/core/sesion-helper', () => ({
  tenantDeSesion: vi.fn(),
}))

vi.mock('@/lib/core/db', () => ({
  supabaseAdmin: vi.fn(() => ({})),
}))

// ─── Imports post-mock ────────────────────────────────────────────────────────

import { listarAutorizados, agregarAutorizado, quitarAutorizado } from '@/lib/core/allowlist'
import { tenantDeSesion } from '@/lib/core/sesion-helper'

const mockListar = vi.mocked(listarAutorizados)
const mockAgregar = vi.mocked(agregarAutorizado)
const mockQuitar = vi.mocked(quitarAutorizado)
const mockSesion = vi.mocked(tenantDeSesion)

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SESION = { usuarioId: 1, tenantId: 42, rol: 'admin' as const }

function makeGet(): Request {
  return new Request('http://localhost/api/autorizados', { method: 'GET' })
}

function makePost(body: unknown): Request {
  return new Request('http://localhost/api/autorizados', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDelete(body: unknown): Request {
  return new Request('http://localhost/api/autorizados', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('/api/autorizados', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  // ── GET ──────────────────────────────────────────────────────────────────

  it('GET con sesión → llama listarAutorizados con tenantId y devuelve 200', async () => {
    mockSesion.mockResolvedValueOnce(SESION)
    mockListar.mockResolvedValueOnce([
      { numero: '51999', etiqueta: 'Cliente X', created_at: '2026-01-01T00:00:00Z' },
    ])

    const { GET } = await import('../autorizados/route')
    const res = await GET()

    expect(res.status).toBe(200)
    expect(mockListar).toHaveBeenCalledWith(42)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].numero).toBe('51999')
  })

  it('GET sin sesión → 401', async () => {
    mockSesion.mockResolvedValueOnce(null)

    const { GET } = await import('../autorizados/route')
    const res = await GET()

    expect(res.status).toBe(401)
    expect(mockListar).not.toHaveBeenCalled()
  })

  // ── POST ─────────────────────────────────────────────────────────────────

  it('POST {numero, etiqueta} con sesión → llama agregarAutorizado y devuelve 200', async () => {
    mockSesion.mockResolvedValueOnce(SESION)
    mockAgregar.mockResolvedValueOnce(undefined)

    const { POST } = await import('../autorizados/route')
    const res = await POST(makePost({ numero: '51999', etiqueta: 'Cliente X' }))

    expect(res.status).toBe(200)
    expect(mockAgregar).toHaveBeenCalledWith('51999', 'Cliente X', 42)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it('POST sin numero → 400 sin llamar agregarAutorizado', async () => {
    mockSesion.mockResolvedValueOnce(SESION)

    const { POST } = await import('../autorizados/route')
    const res = await POST(makePost({ etiqueta: 'Solo etiqueta' }))

    expect(res.status).toBe(400)
    expect(mockAgregar).not.toHaveBeenCalled()
  })

  it('POST sin sesión → 401', async () => {
    mockSesion.mockResolvedValueOnce(null)

    const { POST } = await import('../autorizados/route')
    const res = await POST(makePost({ numero: '51999' }))

    expect(res.status).toBe(401)
    expect(mockAgregar).not.toHaveBeenCalled()
  })

  // ── DELETE ───────────────────────────────────────────────────────────────

  it('DELETE {numero} con sesión → llama quitarAutorizado y devuelve 200', async () => {
    mockSesion.mockResolvedValueOnce(SESION)
    mockQuitar.mockResolvedValueOnce(undefined)

    const { DELETE } = await import('../autorizados/route')
    const res = await DELETE(makeDelete({ numero: '51999' }))

    expect(res.status).toBe(200)
    expect(mockQuitar).toHaveBeenCalledWith('51999', 42)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it('DELETE sin numero → 400 sin llamar quitarAutorizado', async () => {
    mockSesion.mockResolvedValueOnce(SESION)

    const { DELETE } = await import('../autorizados/route')
    const res = await DELETE(makeDelete({}))

    expect(res.status).toBe(400)
    expect(mockQuitar).not.toHaveBeenCalled()
  })

  it('DELETE sin sesión → 401', async () => {
    mockSesion.mockResolvedValueOnce(null)

    const { DELETE } = await import('../autorizados/route')
    const res = await DELETE(makeDelete({ numero: '51999' }))

    expect(res.status).toBe(401)
    expect(mockQuitar).not.toHaveBeenCalled()
  })
})
