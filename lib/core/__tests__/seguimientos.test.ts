import { describe, it, expect } from 'vitest'
import { seleccionarSeguimientos, plantillaSeguimiento, esOptOut, ventanaHoraria, type LeadSeguimiento } from '../seguimientos'

const H = 3600_000
const base = (p: Partial<LeadSeguimiento>): LeadSeguimiento => ({
  remitente: 'r', score: 70, derivado: false, cierreEstado: null,
  ultimoRol: 'bot', ultimoAtMs: 0, ...p,
})
const opts = (p: Partial<Parameters<typeof seleccionarSeguimientos>[1]> = {}) =>
  ({ ahoraMs: 100 * H, horaLocal: 12, ...p })

describe('seleccionarSeguimientos — re-enganche', () => {
  it('toque 1 a partir de +45min, esperando al cliente, lead caliente', () => {
    const r = seleccionarSeguimientos([base({ ultimoAtMs: 100 * H - 1 * H })], opts())
    expect(r).toEqual([{ remitente: 'r', tipo: 'reenganche', toque: 1 }])
  })
  it('elige el toque más alto cuya ventana abrió (no envía toques viejos)', () => {
    const r = seleccionarSeguimientos([base({ ultimoAtMs: 100 * H - 30 * H })], opts())
    expect(r[0].toque).toBe(2)
  })
  it('no repite un toque ya enviado', () => {
    const env = new Map([['r', new Set(['reenganche:1'])]])
    const r = seleccionarSeguimientos([base({ ultimoAtMs: 100 * H - 2 * H })], opts({ enviados: env }))
    expect(r).toEqual([])
  })
  it('si el cliente respondió último (la pelota es suya), no interrumpe', () => {
    const r = seleccionarSeguimientos([base({ ultimoRol: 'cliente', ultimoAtMs: 100 * H - 2 * H })], opts())
    expect(r).toEqual([])
  })
  it('lead frío no entra; opt-out no entra; fuera de horario nada', () => {
    expect(seleccionarSeguimientos([base({ score: 20, ultimoAtMs: 100 * H - 2 * H })], opts())).toEqual([])
    expect(seleccionarSeguimientos([base({ optout: true, ultimoAtMs: 100 * H - 2 * H })], opts())).toEqual([])
    expect(seleccionarSeguimientos([base({ ultimoAtMs: 100 * H - 2 * H })], opts({ horaLocal: 3 }))).toEqual([])
  })
  it('pasado el tope de 96h ya no toca', () => {
    expect(seleccionarSeguimientos([base({ ultimoAtMs: 100 * H - 200 * H })], opts())).toEqual([])
  })
  it('lead ya cerrado (ganado/reservada) no recibe re-enganche', () => {
    expect(seleccionarSeguimientos([base({ cierreEstado: 'reservada', ultimoAtMs: 100 * H - 2 * H })], opts())).toEqual([])
  })
})

describe('seleccionarSeguimientos — postventa', () => {
  it('check-in entre 14 y 30 días tras ganar', () => {
    const r = seleccionarSeguimientos([base({ cierreEstado: 'ganado', ganadoAtMs: 100 * H - 20 * 24 * H })], opts())
    expect(r).toEqual([{ remitente: 'r', tipo: 'postventa', toque: 1 }])
  })
  it('no antes de 14 días ni después de 30', () => {
    expect(seleccionarSeguimientos([base({ cierreEstado: 'ganado', ganadoAtMs: 100 * H - 5 * 24 * H })], opts())).toEqual([])
    expect(seleccionarSeguimientos([base({ cierreEstado: 'ganado', ganadoAtMs: 100 * H - 40 * 24 * H })], opts())).toEqual([])
  })
})

describe('ventanaHoraria + respeto del horario del negocio', () => {
  it('parsea "08:00 - 18:00" y "Lun-Sáb 9am a 7pm"', () => {
    expect(ventanaHoraria('08:00 - 18:00')).toEqual({ apertura: 8, cierre: 18 })
    expect(ventanaHoraria('Lun-Sáb 9am a 7pm')).toEqual({ apertura: 9, cierre: 19 })
  })
  it('default seguro cuando no hay/parsea mal; clamp anti-madrugada [8,21]', () => {
    expect(ventanaHoraria(null)).toEqual({ apertura: 9, cierre: 20 })
    expect(ventanaHoraria('24 horas 00:00 - 23:59')).toEqual({ apertura: 8, cierre: 21 })
  })
  it('el selector respeta la ventana del negocio (no envía fuera de horario)', () => {
    const lead = base({ ultimoAtMs: 100 * H - 2 * H })
    // 8am con negocio que abre 9 → nada; 9am → sí
    expect(seleccionarSeguimientos([lead], opts({ horaLocal: 8, apertura: 9, cierre: 18 }))).toEqual([])
    expect(seleccionarSeguimientos([lead], opts({ horaLocal: 9, apertura: 9, cierre: 18 })).length).toBe(1)
    // 18 con cierre 18 (exclusivo) → nada
    expect(seleccionarSeguimientos([lead], opts({ horaLocal: 18, apertura: 9, cierre: 18 }))).toEqual([])
  })
})

describe('esOptOut (C3)', () => {
  it('detecta pedidos de baja explícitos', () => {
    for (const m of ['quiero darme de baja', 'no me escriban más', 'STOP', 'baja', 'no quiero promociones', 'desuscribirme'])
      expect(esOptOut(m)).toBe(true)
  })
  it('no confunde con menciones benignas de "bajo"', () => {
    for (const m of ['tienen algo de precio bajo?', 'busco algo en temporada baja', 'hola, bajaste el precio?'])
      expect(esOptOut(m)).toBe(false)
  })
})

describe('plantillaSeguimiento', () => {
  it('toque 3 mete urgencia; postventa hace check-in; usa nombre y producto', () => {
    expect(plantillaSeguimiento({ remitente: 'r', tipo: 'reenganche', toque: 3 }, { nombre: 'Ana', producto: 'Rayuela' })).toContain('Última llamada')
    expect(plantillaSeguimiento({ remitente: 'r', tipo: 'reenganche', toque: 3 }, {})).toContain('Última llamada')
    expect(plantillaSeguimiento({ remitente: 'r', tipo: 'postventa', toque: 1 }, { nombre: 'Ana' })).toContain('Ana')
  })
})
