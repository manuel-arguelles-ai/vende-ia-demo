import { describe, it, expect } from 'vitest'
import { detectarPagoNoAutorizado } from '../antifraude-pago'

const neg = { yape: '987654321', cuenta: '0021-0345-0100123456' }

describe('detectarPagoNoAutorizado', () => {
  it('yape configurado escrito con keyword → OK', () => {
    expect(detectarPagoNoAutorizado('Yapéame al 987654321', neg).fraude).toBe(false)
  })
  it('yape distinto + keyword → fraude', () => {
    const r = detectarPagoNoAutorizado('mejor yapéame al 911222333', neg)
    expect(r.fraude).toBe(true); expect(r.numero).toBe('911222333')
  })
  it('cuenta no configurada con keyword deposita → fraude', () => {
    expect(detectarPagoNoAutorizado('deposita a la cuenta 00299887766554', neg).fraude).toBe(true)
  })
  it('cuenta configurada (con guiones) → OK', () => {
    expect(detectarPagoNoAutorizado('transfiere a 0021 0345 0100123456', neg).fraude).toBe(false)
  })
  it('ISBN 13 díg sin keyword de pago → no fraude', () => {
    expect(detectarPagoNoAutorizado('El ISBN es 9786124179211, te lo reservo', neg).fraude).toBe(false)
  })
  it('precio corto → no fraude', () => {
    expect(detectarPagoNoAutorizado('Te queda S/ 49.90 en total', neg).fraude).toBe(false)
  })
  it('número pelado sin keyword → no fraude (puede ser teléfono)', () => {
    expect(detectarPagoNoAutorizado('mi contacto es 999888777', neg).fraude).toBe(false)
  })
})
