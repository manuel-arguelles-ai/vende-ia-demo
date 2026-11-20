import { describe, it, expect, vi } from 'vitest'
import { procesarSeguimientos, type SeguimientoDeps } from '../seguimientos-run'
import type { LeadSeguimiento } from '../seguimientos'

const H = 3600_000
// 2026-06-15 15:00 UTC → 10:00 Perú (dentro de 9-21)
const AHORA = Date.UTC(2026, 5, 15, 15, 0, 0)

const leadCaliente = (): LeadSeguimiento => ({
  remitente: 'r1', score: 80, derivado: false, cierreEstado: null,
  ultimoRol: 'bot', ultimoAtMs: AHORA - 2 * H, nombre: 'Ana', producto: 'Rayuela',
})

const baseDeps = (over: Partial<SeguimientoDeps>): SeguimientoDeps => ({
  obtenerNegocio: vi.fn().mockResolvedValue({ seguimiento_auto: true, nombre: 'Demo' }),
  cargarLeads: vi.fn().mockResolvedValue([leadCaliente()]),
  cargarEnviados: vi.fn().mockResolvedValue(new Map()),
  enviar: vi.fn().mockResolvedValue(undefined),
  registrarToque: vi.fn().mockResolvedValue(undefined),
  ahoraMs: AHORA,
  ...over,
})

describe('procesarSeguimientos', () => {
  it('flag OFF: no envía nada', async () => {
    const enviar = vi.fn()
    const r = await procesarSeguimientos(6, baseDeps({
      obtenerNegocio: vi.fn().mockResolvedValue({ seguimiento_auto: false }), enviar,
    }))
    expect(r).toEqual({ enviados: 0, motivo: 'flag-off' })
    expect(enviar).not.toHaveBeenCalled()
  })

  it('flag ON: envía el toque y lo registra', async () => {
    const enviar = vi.fn().mockResolvedValue(undefined)
    const registrarToque = vi.fn().mockResolvedValue(undefined)
    const r = await procesarSeguimientos(6, baseDeps({ enviar, registrarToque }))
    expect(r.enviados).toBe(1)
    expect(enviar).toHaveBeenCalledWith('r1', expect.stringContaining('Ana'))
    expect(registrarToque).toHaveBeenCalledWith(6, 'r1', 'reenganche', 1)
  })

  it('un fallo de envío no detiene el resto (best-effort)', async () => {
    const enviar = vi.fn().mockRejectedValue(new Error('boom'))
    const r = await procesarSeguimientos(6, baseDeps({ enviar }))
    expect(r.enviados).toBe(0)
  })
})
