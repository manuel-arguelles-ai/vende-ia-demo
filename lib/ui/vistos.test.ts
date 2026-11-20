import { describe, it, expect } from 'vitest'
import { calcularNuevos } from './vistos'

describe('calcularNuevos', () => {
  it('cuenta los remitentes actuales que no están en vistos', () => {
    expect(calcularNuevos(['a', 'b'], ['a', 'b', 'c', 'd'])).toBe(2)
  })
  it('0 si todos los actuales ya fueron vistos', () => {
    expect(calcularNuevos(['a', 'b', 'c'], ['a', 'b'])).toBe(0)
  })
  it('seed (vistos null) → 0 (no abruma el primer uso)', () => {
    expect(calcularNuevos(null, ['a', 'b', 'c'])).toBe(0)
  })
  it('lista actual vacía → 0', () => {
    expect(calcularNuevos(['a'], [])).toBe(0)
  })
})
