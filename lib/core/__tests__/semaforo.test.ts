import { describe, it, expect } from 'vitest'
import { estiloTemperatura } from '../semaforo-style'

describe('estiloTemperatura', () => {
  it('caliente = rojo + fuego', () => {
    expect(estiloTemperatura('caliente')).toEqual({ color: 'bg-red-500', emoji: '🔥', label: 'Caliente' })
  })
  it('tibio = ámbar', () => {
    expect(estiloTemperatura('tibio').color).toBe('bg-amber-400')
  })
  it('frio = azul', () => {
    expect(estiloTemperatura('frio').color).toBe('bg-blue-400')
  })
})
