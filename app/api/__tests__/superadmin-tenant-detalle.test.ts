import { describe, it, expect, vi, beforeEach } from 'vitest'
const sesionSuperadmin = vi.fn(); const detalleTenant = vi.fn()
vi.mock('@/lib/superadmin-route', () => ({ sesionSuperadmin: () => sesionSuperadmin() }))
vi.mock('@/lib/core/superadmin-detalle', () => ({ detalleTenant: (...a: unknown[]) => detalleTenant(...a) }))
import { GET } from '../superadmin/tenant/route'

const req = (url: string) => new Request(url)
beforeEach(() => { sesionSuperadmin.mockReset(); detalleTenant.mockReset() })

describe('GET /api/superadmin/tenant', () => {
  it('sin sesión super-admin → 401', async () => {
    sesionSuperadmin.mockResolvedValue(null)
    expect((await GET(req('http://x/api/superadmin/tenant?id=6'))).status).toBe(401)
  })
  it('sin id → 400', async () => {
    sesionSuperadmin.mockResolvedValue({ ok: true })
    expect((await GET(req('http://x/api/superadmin/tenant'))).status).toBe(400)
  })
  it('con sesión + id → 200 con el detalle', async () => {
    sesionSuperadmin.mockResolvedValue({ ok: true })
    detalleTenant.mockResolvedValue({ negocio: {}, tiendas: [] })
    const res = await GET(req('http://x/api/superadmin/tenant?id=6'))
    expect(res.status).toBe(200)
    expect(detalleTenant).toHaveBeenCalledWith(6)
  })
})
