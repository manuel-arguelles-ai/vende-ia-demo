import { describe, it, expect } from 'vitest'
import { excedeRate, __resetRate } from '../ratelimit'

describe('excedeRate', () => {
  it('permite hasta 20 en la ventana, bloquea el 21º', () => {
    __resetRate()
    const t0 = 1_000_000
    for (let i = 0; i < 20; i++) expect(excedeRate('6:51999', t0 + i)).toBe(false)
    expect(excedeRate('6:51999', t0 + 21)).toBe(true)
  })

  it('resetea tras la ventana de 60s', () => {
    __resetRate()
    const t0 = 2_000_000
    for (let i = 0; i < 20; i++) excedeRate('6:51999', t0 + i)
    expect(excedeRate('6:51999', t0 + 61_000)).toBe(false) // nueva ventana
  })

  it('claves distintas no se interfieren', () => {
    __resetRate()
    const t0 = 3_000_000
    for (let i = 0; i < 20; i++) excedeRate('6:A', t0 + i)
    expect(excedeRate('6:B', t0 + 1)).toBe(false)
  })
})
