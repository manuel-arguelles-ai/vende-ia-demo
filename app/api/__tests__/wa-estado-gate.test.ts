/**
 * Tests para GET /api/wa-estado — gate de WhatsApp por plan (sub-proyecto H).
 * Free no puede conectar WhatsApp (no se toca el worker); pro+ sí.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/core/sesion-helper', () => ({
  tenantDeSesion: vi.fn(),
}))

vi.mock('@/lib/core/plataforma', async (orig) => {
  const real = await orig<typeof import('@/lib/core/plataforma')>()
  return { ...real, obtenerTenantPlan: vi.fn() }
})

import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { obtenerTenantPlan } from '@/lib/core/plataforma'
import { GET } from '../wa-estado/route'

const mockSesion = vi.mocked(tenantDeSesion)
const mockPlan = vi.mocked(obtenerTenantPlan)

describe('GET /api/wa-estado — gate por plan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.WORKER_URL = 'http://worker.test'
    process.env.WORKER_TOKEN = 'tok'
  })

  it('sin sesión → 401', async () => {
    mockSesion.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('tenant free → disponible:false, motivo plan, NO llama al worker', async () => {
    mockSesion.mockResolvedValue({ usuarioId: 1, tenantId: 7, rol: 'admin' })
    mockPlan.mockResolvedValue({ plan: 'free', sub_estado: null })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const res = await GET()
    const body = await res.json()

    expect(body.disponible).toBe(false)
    expect(body.motivo).toBe('plan')
    expect(body.connected).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('tenant pro → llama al worker y devuelve su estado', async () => {
    mockSesion.mockResolvedValue({ usuarioId: 1, tenantId: 7, rol: 'admin' })
    mockPlan.mockResolvedValue({ plan: 'pro', sub_estado: 'authorized' })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ connected: true, qr: null }), { status: 200 }),
    )

    const res = await GET()
    const body = await res.json()

    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/qr?tenant=7')
    expect(body.disponible).toBe(true)
    expect(body.connected).toBe(true)
    fetchSpy.mockRestore()
  })
})
