import { describe, it, expect } from 'vitest'
import { redactarTexto, redactarRemitente } from '../redaccion'

describe('redactarTexto', () => {
  it('no vuelca el contenido completo: muestra longitud + preview corto', () => {
    const r = redactarTexto('hola tienen aceite de coco en stock para llevar hoy mismo')
    expect(r).toContain('chars')
    expect(r).not.toContain('stock para llevar hoy mismo') // no filtra la frase completa
    expect(r.length).toBeLessThan(40)
  })
  it('vacío → marcador', () => {
    expect(redactarTexto('')).toBe('[vacío]')
  })
})

describe('redactarRemitente', () => {
  it('enmascara el número conservando los últimos 4', () => {
    expect(redactarRemitente('51987654321@s.whatsapp.net')).toBe('…4321')
    expect(redactarRemitente('51987654321')).toBe('…4321')
  })
  it('corto → enmascarado genérico', () => {
    expect(redactarRemitente('12')).toBe('…')
  })
})
