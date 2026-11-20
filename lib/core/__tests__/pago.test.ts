import { describe, it, expect } from 'vitest'
import { verificarPago, pagosPrevios } from '../pago'

describe('verificarPago', () => {
  it('pago exacto o de más → ok, sin faltante', () => {
    expect(verificarPago(45.3, 45.3)).toEqual({ ok: true, falta: 0 })
    expect(verificarPago(50, 45.3)).toEqual({ ok: true, falta: 0 })
  })
  it('pago menor → no ok, con el faltante', () => {
    expect(verificarPago(45, 45.3)).toEqual({ ok: false, falta: 0.3 })
    expect(verificarPago(43, 45.3)).toEqual({ ok: false, falta: 2.3 })
  })
  it('tolerancia de centavos (redondeo mínimo) → ok', () => {
    expect(verificarPago(45.25, 45.3).ok).toBe(true) // faltan 0.05 ≤ 0.10
    expect(verificarPago(45.1, 45.3).ok).toBe(false) // faltan 0.20 > 0.10
  })
})

describe('pagosPrevios', () => {
  it('suma los comprobantes previos del cliente en el historial', () => {
    const h = [
      { rol: 'cliente', texto: '¿tienen el libro?' },
      { rol: 'bot', texto: 'Sí, S/45.30' },
      { rol: 'cliente', texto: '[Comprobante de pago Yape: S/ 43]' },
      { rol: 'bot', texto: 'Faltan S/2.30' },
    ]
    expect(pagosPrevios(h)).toBe(43)
  })
  it('acumula varios comprobantes y tolera "Yape/Plin" y decimales', () => {
    const h = [
      { rol: 'cliente', texto: '[Comprobante de pago Yape: S/ 43.00]' },
      { rol: 'cliente', texto: '[Comprobante de pago Yape/Plin: S/ 2.30]' },
    ]
    expect(pagosPrevios(h)).toBe(45.3)
  })
  it('ignora comprobantes del bot/asesor y mensajes sin marcador', () => {
    const h = [
      { rol: 'bot', texto: '[Comprobante de pago Yape: S/ 99]' },
      { rol: 'cliente', texto: 'hola' },
    ]
    expect(pagosPrevios(h)).toBe(0)
  })
})
