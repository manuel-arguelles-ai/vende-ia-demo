import { describe, it, expect } from 'vitest'
import { PLANES, planTieneWhatsapp, planTieneVoz } from '../plataforma'

describe('PLANES límites', () => {
  it('cada plan tiene mensajes_mes, asesores y voz', () => {
    for (const k of ['free', 'pro', 'max', 'enterprise'] as const) {
      const l = PLANES[k].limites as { mensajes_mes: number; asesores: number; voz: boolean }
      expect(typeof l.mensajes_mes).toBe('number')
      expect(typeof l.asesores).toBe('number')
      expect(typeof l.voz).toBe('boolean')
    }
  })
  it('free no tiene voz; pro/max sí', () => {
    expect((PLANES.free.limites as { voz: boolean }).voz).toBe(false)
    expect((PLANES.pro.limites as { voz: boolean }).voz).toBe(true)
    expect((PLANES.max.limites as { voz: boolean }).voz).toBe(true)
  })
  it('free 1 asesor, pro 3, max 10', () => {
    expect((PLANES.free.limites as { asesores: number }).asesores).toBe(1)
    expect((PLANES.pro.limites as { asesores: number }).asesores).toBe(3)
    expect((PLANES.max.limites as { asesores: number }).asesores).toBe(10)
  })
})

describe('planTieneWhatsapp', () => {
  it('pro, max y enterprise habilitan WhatsApp', () => {
    expect(planTieneWhatsapp('pro')).toBe(true)
    expect(planTieneWhatsapp('max')).toBe(true)
    expect(planTieneWhatsapp('enterprise')).toBe(true)
  })
  it('free no habilita WhatsApp', () => {
    expect(planTieneWhatsapp('free')).toBe(false)
  })
  it('plan desconocido o vacío → false (fail-closed)', () => {
    expect(planTieneWhatsapp('')).toBe(false)
    expect(planTieneWhatsapp('otro')).toBe(false)
  })
})

describe('planTieneVoz', () => {
  it('pro, max y enterprise habilitan voz', () => {
    expect(planTieneVoz('pro')).toBe(true)
    expect(planTieneVoz('max')).toBe(true)
    expect(planTieneVoz('enterprise')).toBe(true)
  })
  it('free no habilita voz', () => {
    expect(planTieneVoz('free')).toBe(false)
  })
  it('plan desconocido o vacío → false (fail-closed)', () => {
    expect(planTieneVoz('')).toBe(false)
    expect(planTieneVoz('otro')).toBe(false)
  })
})
