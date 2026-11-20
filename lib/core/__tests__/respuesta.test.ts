import { describe, it, expect } from 'vitest'
import { respuestaPara } from '../respuesta'
import type { PedidoGuardado } from '../schemas'

const base: PedidoGuardado = {
  producto: 'polera', color: 'roja', talla: 'M', cantidad: 2, extra: {},
  necesita_aclaracion: false, temperatura: 'tibio', score: 50, razon: 'x',
  canal: 'whatsapp', remitente: '51999', mensaje_crudo: '...', derivar: false, estado: 'nuevo',
}

const match = {
  nombre: 'Green House Aceite de coco - 680 ml',
  marca: 'Green House', precio: 57.9, presentacion: 'unidad', stock: 12, categoria: 'Aceites',
  descripcion: null, confianza: 'alta' as const,
}

describe('respuestaPara', () => {
  it('pide aclaración cuando necesita_aclaracion', () => {
    const r = respuestaPara({ ...base, necesita_aclaracion: true })
    expect(r.toLowerCase()).toContain('producto')
  })

  it('da mensaje de handoff cuando deriva (caliente) y no hay match', () => {
    const r = respuestaPara({ ...base, derivar: true, temperatura: 'caliente' })
    expect(r.toLowerCase()).toContain('asesor')
  })

  it('da acuse normal cuando no deriva ni hay match', () => {
    const r = respuestaPara(base)
    expect(r.toLowerCase()).toContain('anot')
    expect(r).toContain('polera')
  })

  it('responde con precio y stock cuando hay match en stock', () => {
    const r = respuestaPara({ ...base, match })
    expect(r).toContain('S/57.90')
    expect(r).toContain('12')
    expect(r).toContain('Green House Aceite de coco')
  })

  it('avisa agotado cuando el match tiene stock 0', () => {
    const r = respuestaPara({ ...base, match: { ...match, stock: 0 } })
    expect(r.toLowerCase()).toContain('agotado')
  })
})
