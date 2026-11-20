import { describe, it, expect } from 'vitest'
import { etapaLifecycle } from '../lifecycle'

describe('etapaLifecycle', () => {
  it('clasifica por score cuando el lead está abierto', () => {
    expect(etapaLifecycle({ score: 10 })).toBe('nuevo')
    expect(etapaLifecycle({ score: 40 })).toBe('interesado')
    expect(etapaLifecycle({ score: 75 })).toBe('cotizado')
    expect(etapaLifecycle({ score: 20, derivado: true })).toBe('cotizado')
  })
  it('cierre ganado → cliente; 2+ ganados → recurrente', () => {
    expect(etapaLifecycle({ score: 90, cierreEstado: 'ganado' })).toBe('cliente')
    expect(etapaLifecycle({ score: 90, cierreEstado: 'ganado', comprasGanadas: 3 })).toBe('recurrente')
  })
  it('reservada = cotizado; perdido = perdido', () => {
    expect(etapaLifecycle({ score: 88, cierreEstado: 'reservada' })).toBe('cotizado')
    expect(etapaLifecycle({ score: 50, cierreEstado: 'perdido' })).toBe('perdido')
  })
  it('inactividad >30 días → dormido (si no está cerrado)', () => {
    expect(etapaLifecycle({ score: 70, diasInactivo: 45 })).toBe('dormido')
    expect(etapaLifecycle({ score: 90, cierreEstado: 'ganado', diasInactivo: 45 })).toBe('cliente')
  })
})
