import { describe, it, expect, vi, beforeEach } from 'vitest'
const tenantDeSesion = vi.fn(); const registrar = vi.fn()
vi.mock('@/lib/core/sesion-helper', () => ({ tenantDeSesion: (...a: unknown[]) => tenantDeSesion(...a) }))
vi.mock('@/lib/core/visibilidad', () => ({ puedeVerRemitente: () => Promise.resolve(true) }))
vi.mock('@/lib/core/autorizacion', () => ({ asesorPuedeEditar: () => Promise.resolve(true) }))
vi.mock('@/lib/core/negocio', () => ({ obtenerNegocio: () => Promise.resolve({ yape: '987654321' }) }))
vi.mock('@/lib/core/alertas', () => ({ registrarAlertaFraude: (...a: unknown[]) => registrar(...a) }))
vi.mock('@/lib/core/control', () => ({ setBotPausado: () => Promise.resolve() }))
vi.mock('@/lib/core/historial', () => ({ guardarMensaje: () => Promise.resolve() }))
vi.mock('@/lib/core/db', () => ({
  supabaseAdmin: () => {
    const b: Record<string, unknown> = { select: () => b, eq: () => b, order: () => b, limit: () => b, maybeSingle: () => Promise.resolve({ data: null }) }
    return { from: () => b }
  },
}))
import { POST } from '../../api/responder/route'
const req = (b: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(b) })
beforeEach(() => { tenantDeSesion.mockReset(); registrar.mockReset() })

describe('responder antifraude', () => {
  it('asesor + pago no configurado → 403 + alerta, no envía', async () => {
    tenantDeSesion.mockResolvedValue({ tenantId: 6, rol: 'asesor' })
    const res = await POST(req({ remitente: 'sim-1', texto: 'yapéame al 911222333' }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('forma_pago_no_autorizada')
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ autor: 'asesor' }))
  })
  it('admin + pago no configurado → pasa (200) pero alerta igual', async () => {
    tenantDeSesion.mockResolvedValue({ tenantId: 6, rol: 'admin' })
    const res = await POST(req({ remitente: 'sim-1', texto: 'yapéame al 911222333' }))
    expect(res.status).toBe(200); expect(registrar).toHaveBeenCalled()
  })
  it('texto limpio → 200 sin alerta', async () => {
    tenantDeSesion.mockResolvedValue({ tenantId: 6, rol: 'asesor' })
    const res = await POST(req({ remitente: 'sim-1', texto: 'Hola, ya te lo reservo' }))
    expect(res.status).toBe(200); expect(registrar).not.toHaveBeenCalled()
  })
})
