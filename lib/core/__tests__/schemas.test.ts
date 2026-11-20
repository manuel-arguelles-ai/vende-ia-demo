import { describe, it, expect } from 'vitest'
import { PedidoSchema, ScoringSchema } from '../schemas'

describe('PedidoSchema', () => {
  it('parsea un pedido completo y aplica default extra={}', () => {
    const p = PedidoSchema.parse({
      producto: 'polera', color: 'roja', talla: 'M', cantidad: 1,
      necesita_aclaracion: false,
    })
    expect(p.producto).toBe('polera')
    expect(p.extra).toEqual({})
  })

  it('acepta nulls y necesita_aclaracion true', () => {
    const p = PedidoSchema.parse({
      producto: null, color: null, talla: null, cantidad: null,
      necesita_aclaracion: true,
    })
    expect(p.necesita_aclaracion).toBe(true)
  })

  it('rechaza si falta necesita_aclaracion', () => {
    expect(() => PedidoSchema.parse({ producto: 'x', color: null, talla: null, cantidad: null }))
      .toThrow()
  })
})

describe('ScoringSchema', () => {
  it('parsea scoring válido', () => {
    const s = ScoringSchema.parse({ temperatura: 'caliente', score: 90, razon: 'pide precio y stock' })
    expect(s.temperatura).toBe('caliente')
  })

  it('rechaza temperatura inválida', () => {
    expect(() => ScoringSchema.parse({ temperatura: 'hirviendo', score: 90, razon: 'x' })).toThrow()
  })

  it('rechaza score fuera de rango', () => {
    expect(() => ScoringSchema.parse({ temperatura: 'frio', score: 200, razon: 'x' })).toThrow()
  })
})
