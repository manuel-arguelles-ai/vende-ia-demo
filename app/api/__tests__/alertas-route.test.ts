import { describe, it, expect, vi, beforeEach } from 'vitest'
const requireAdmin = vi.fn(); const alertasFraude = vi.fn()
vi.mock('@/lib/core/autorizacion', () => ({ requireAdmin: () => requireAdmin() }))
vi.mock('@/lib/core/alertas', () => ({ alertasFraude: (...a: unknown[]) => alertasFraude(...a), resolverAlerta: vi.fn() }))
import { GET } from '../../api/alertas/route'
beforeEach(() => { requireAdmin.mockReset(); alertasFraude.mockReset() })

describe('GET /api/alertas', () => {
  it('asesor → 403', async () => {
    requireAdmin.mockResolvedValue({ error: new Response('no', { status: 403 }) })
    expect((await GET()).status).toBe(403)
  })
  it('admin → lista', async () => {
    requireAdmin.mockResolvedValue({ sesion: { tenantId: 6, rol: 'admin' } })
    alertasFraude.mockResolvedValue([{ id: 1 }])
    const res = await GET(); expect(res.status).toBe(200); expect((await res.json()).length).toBe(1)
  })
})
