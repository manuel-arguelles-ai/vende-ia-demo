import { describe, it, expect } from 'vitest'
import { detectarCierreAuto } from '../cierre-auto'

const T = [
  { id: 1, nombre: 'Central', direccion: null, distrito: null, horario: null, activa: true },
  { id: 2, nombre: 'Miraflores', direccion: null, distrito: null, horario: null, activa: true },
]

describe('detectarCierreAuto', () => {
  it('venta: yape + recojo en tienda mencionada', () => {
    expect(detectarCierreAuto('pago por yape y recojo en Central', null, T)).toEqual({ tipo: 'venta', tiendaNombre: 'Central' })
  })
  it('reserva: apartar y pagar en tienda', () => {
    expect(detectarCierreAuto('resérvamelo, paso a pagar en Miraflores', null, T)).toEqual({ tipo: 'reserva', tiendaNombre: 'Miraflores' })
  })
  it('reserva tiene prioridad sobre venta si hay ambas señales', () => {
    expect(detectarCierreAuto('quiero reservarlo y pagar en tienda, recojo en Central', null, T)?.tipo).toBe('reserva')
  })
  it('usa la tienda propuesta por el LLM si coincide', () => {
    expect(detectarCierreAuto('listo, pago yape', { tipo: 'venta', tienda: 'central' }, T)).toEqual({ tipo: 'venta', tiendaNombre: 'Central' })
  })
  it('sin tienda mencionada → null', () => {
    expect(detectarCierreAuto('pago por yape', null, T)).toBeNull()
  })
  it('tienda mencionada pero sin forma → null', () => {
    expect(detectarCierreAuto('queda cerca la de Central?', null, T)).toBeNull()
  })
  it('sin tiendas configuradas → null', () => {
    expect(detectarCierreAuto('pago yape y recojo en Central', null, [])).toBeNull()
  })
})
