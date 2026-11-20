import { describe, it, expect, vi, beforeEach } from 'vitest'
const sesionSuperadmin = vi.fn()
const metricasTenants = vi.fn()
const saludCanales = vi.fn()
const resumenPlataforma = vi.fn()
vi.mock('@/lib/superadmin-route', () => ({ sesionSuperadmin: () => sesionSuperadmin() }))
vi.mock('@/lib/core/plataforma', async (orig) => ({ ...(await orig() as object), metricasTenants: (...a: unknown[]) => metricasTenants(...a) }))
vi.mock('@/lib/core/monitoreo', () => ({ saludCanales: () => saludCanales(), resumenPlataforma: (...a: unknown[]) => resumenPlataforma(...a) }))
vi.mock('@/lib/core/eventos', () => ({ eventosRecientes: vi.fn().mockResolvedValue([]) }))
import { GET } from '../../api/superadmin/tenants/route'
beforeEach(() => { [sesionSuperadmin, metricasTenants, saludCanales, resumenPlataforma].forEach(m => m.mockReset()) })

describe('GET /api/superadmin/tenants monitoreo', () => {
  it('sin sesión super-admin → 401', async () => {
    sesionSuperadmin.mockResolvedValue(false)
    expect((await GET()).status).toBe(401)
  })
  it('con sesión → { tenants, resumen }', async () => {
    sesionSuperadmin.mockResolvedValue(true)
    saludCanales.mockResolvedValue({ porTenant: new Map(), workerCaido: false })
    metricasTenants.mockResolvedValue([{ id: 1 }])
    resumenPlataforma.mockReturnValue({ tenants_total: 1 })
    const res = await GET()
    const b = await res.json()
    expect(res.status).toBe(200)
    expect(b.tenants).toEqual([{ id: 1 }])
    expect(b.resumen).toEqual({ tenants_total: 1 })
  })
})
