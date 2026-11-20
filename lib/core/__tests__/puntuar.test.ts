import { describe, it, expect, vi } from 'vitest'
import { puntuar } from '../puntuar'
import type { Pedido } from '../schemas'

const pedido: Pedido = {
  producto: 'polera', color: 'roja', talla: 'M', cantidad: 1,
  extra: {}, necesita_aclaracion: false,
}

describe('puntuar', () => {
  it('devuelve temperatura, score y razón', async () => {
    const fakeChat = vi.fn().mockResolvedValue({
      temperatura: 'caliente', score: 88, razon: 'pregunta precio y forma de pago',
    })
    const s = await puntuar('cuánto sale? pago hoy', pedido, fakeChat)
    expect(s.temperatura).toBe('caliente')
    expect(s.score).toBe(88)
  })

  it('incluye el mensaje y el pedido en el prompt', async () => {
    const fakeChat = vi.fn().mockResolvedValue({ temperatura: 'frio', score: 10, razon: 'solo mira' })
    await puntuar('solo preguntaba', pedido, fakeChat)
    const arg = fakeChat.mock.calls[0][0]
    expect(arg.user).toContain('solo preguntaba')
    expect(arg.user).toContain('polera')
  })
})
