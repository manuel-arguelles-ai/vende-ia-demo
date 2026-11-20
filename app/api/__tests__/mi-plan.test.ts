/**
 * Tests para GET /api/mi-plan
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/core/sesion-helper', () => ({
  tenantDeSesion: vi.fn(),
}))

vi.mock('@/lib/core/perfil', () => ({
  obtenerPerfil: vi.fn(),
}))

vi.mock('@/lib/core/limites', () => ({
  estadoLimiteMensajes: vi.fn(),
}))

const mockMaybeSingle = vi.fn()
const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/core/db', () => ({
  supabaseAdmin: vi.fn(() => ({ from: mockFrom })),
}))

// ─── Imports post-mock ────────────────────────────────────────────────────────

import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { obtenerPerfil } from '@/lib/core/perfil'
import { estadoLimiteMensajes } from '@/lib/core/limites'

const mockSesion = vi.mocked(tenantDeSesion)
const mockObtenerPerfil = vi.mocked(obtenerPerfil)
const mockEstadoLimiteMensajes = vi.mocked(estadoLimiteMensajes)

const SESION = { usuarioId: 3, tenantId: 10, rol: 'admin' as const }

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('GET /api/mi-plan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    // Default limites mock
    mockEstadoLimiteMensajes.mockResolvedValue({ excedido: false, bloquear: false, usados: 0, limite: 1000 })
    // Default perfil and email mocks for success cases
    mockObtenerPerfil.mockResolvedValue({
      nombreBot: 'Vera',
      tono: 'cercano',
      instruccionesExtra: null,
      negocioNombre: null,
      rubro: null,
      categorias: null,
      saludoInicial: null,
      mensajeNoSe: null,
      temasProhibidos: null,
      emojis: true,
      longitud: 'cortas',
      intensidadCierre: 'cerrador',
      agresividad: 'suave',
    })
    mockMaybeSingle.mockResolvedValue({ data: { email: 'ventas@example.com' }, error: null })
  })

  it('sin sesión → 401', async () => {
    mockSesion.mockResolvedValueOnce(null)

    const { GET } = await import('../mi-plan/route')
    const res = await GET()

    expect(res.status).toBe(401)
  })

  it('con sesión y tenant encontrado → 200 con campos del plan', async () => {
    mockSesion.mockResolvedValueOnce(SESION)
    mockSingle.mockResolvedValueOnce({
      data: { nombre: 'Demo', plan: 'pro', sub_estado: 'authorized', sub_proximo_cobro: '2026-07-01', trial_fin: null },
      error: null,
    })

    const { GET } = await import('../mi-plan/route')
    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.plan).toBe('pro')
    expect(body.sub_estado).toBe('authorized')
    expect(body.sub_proximo_cobro).toBe('2026-07-01')
    expect(body.trial_fin).toBeNull()
    expect(body.nombreBot).toBe('Vera')
    expect(body.email).toBe('ventas@example.com')
  })

  it('con sesión en trial → 200 con trial_fin', async () => {
    mockSesion.mockResolvedValueOnce(SESION)
    mockSingle.mockResolvedValueOnce({
      data: { nombre: null, plan: 'pro', sub_estado: 'trial', sub_proximo_cobro: null, trial_fin: '2026-06-27T00:00:00.000Z' },
      error: null,
    })

    const { GET } = await import('../mi-plan/route')
    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sub_estado).toBe('trial')
    expect(body.trial_fin).toBe('2026-06-27T00:00:00.000Z')
  })

  it('tenant no encontrado en DB → 404', async () => {
    mockSesion.mockResolvedValueOnce(SESION)
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })

    const { GET } = await import('../mi-plan/route')
    const res = await GET()

    expect(res.status).toBe(404)
  })

  it('consulta tenant por tenantId de la sesión', async () => {
    mockSesion.mockResolvedValueOnce(SESION)
    mockSingle.mockResolvedValueOnce({
      data: { nombre: null, plan: 'free', sub_estado: null, sub_proximo_cobro: null, trial_fin: null },
      error: null,
    })

    const { GET } = await import('../mi-plan/route')
    await GET()

    expect(mockFrom).toHaveBeenCalledWith('tenants')
    expect(mockEq).toHaveBeenCalledWith('id', SESION.tenantId)
  })
})
