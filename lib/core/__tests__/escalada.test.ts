import { describe, it, expect } from 'vitest'
import { requiereEscalada, resumenEscalada } from '../escalada'

describe('requiereEscalada', () => {
  it('detecta quejas / fraude / no-entrega / reembolso (con y sin acento)', () => {
    for (const m of [
      'Quiero un RECLAMO formal',
      'esto es una estafa',
      'mi pedido no llegó',
      'exijo un reembolso ya',
      'voy a denunciar a indecopi',
      'el producto llego roto',
      'quiero mi dinero de vuelta',
    ]) expect(requiereEscalada(m)).toBe(true)
  })
  it('NO escala consultas normales de venta', () => {
    for (const m of [
      'hola, tienen el libro de python?',
      'cuánto cuesta y hay stock?',
      'me lo reservas para mañana?',
    ]) expect(requiereEscalada(m)).toBe(false)
  })
  it('resumen incluye el texto del cliente recortado', () => {
    expect(resumenEscalada('no llegó mi pedido')).toContain('no llegó mi pedido')
    expect(resumenEscalada('x'.repeat(300)).length).toBeLessThan(240)
  })
})
