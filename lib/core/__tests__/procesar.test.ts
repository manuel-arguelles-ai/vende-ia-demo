import { describe, it, expect, vi } from 'vitest'
import { procesar } from '../procesar'
import type { Pedido, Scoring, PedidoGuardado } from '../schemas'

const pedido: Pedido = {
  producto: 'polera', color: 'roja', talla: 'M', cantidad: 1, extra: {}, necesita_aclaracion: false,
}

describe('procesar', () => {
  it('extrae, puntúa, marca derivar=caliente y guarda', async () => {
    const scoring: Scoring = { temperatura: 'caliente', score: 90, razon: 'pide precio' }
    const deps = {
      extraer: vi.fn().mockResolvedValue(pedido),
      puntuar: vi.fn().mockResolvedValue(scoring),
      insertPedido: vi.fn().mockImplementation(async (r: PedidoGuardado) => ({ ...r, id: 7 })),
      buscarProducto: vi.fn().mockResolvedValue(null),
    }
    const saved = await procesar(
      { mensaje: 'polera roja M, cuánto sale?', canal: 'whatsapp', remitente: '51999' },
      deps,
    )
    expect(deps.extraer).toHaveBeenCalledWith('polera roja M, cuánto sale?')
    expect(deps.puntuar).toHaveBeenCalledWith('polera roja M, cuánto sale?', pedido)
    expect(deps.buscarProducto).toHaveBeenCalledWith('polera')
    expect(saved.derivar).toBe(true)
    expect(saved.canal).toBe('whatsapp')
    expect(saved.mensaje_crudo).toBe('polera roja M, cuánto sale?')
    expect(saved.id).toBe(7)
    expect(saved.match).toBeNull()
  })

  it('derivar=false cuando no es caliente', async () => {
    const deps = {
      extraer: vi.fn().mockResolvedValue(pedido),
      puntuar: vi.fn().mockResolvedValue({ temperatura: 'frio', score: 10, razon: 'curiosea' }),
      insertPedido: vi.fn().mockImplementation(async (r: PedidoGuardado) => r),
      buscarProducto: vi.fn().mockResolvedValue(null),
    }
    const saved = await procesar({ mensaje: 'hola', canal: 'simulador', remitente: 'demo' }, deps)
    expect(saved.derivar).toBe(false)
  })
})
