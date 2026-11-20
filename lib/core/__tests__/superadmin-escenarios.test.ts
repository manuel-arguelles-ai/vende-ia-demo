import { describe, it, expect } from 'vitest'
import { parsearEscenarios } from '../superadmin-detalle'

describe('parsearEscenarios', () => {
  const contactos = [
    { remitente: 'r-e1', nombre: 'E1 · Camila Rojas' },
    { remitente: 'r-b10', nombre: 'B10 · Mateo Quispe' },
    { remitente: 'r-a1', nombre: 'A1 · Lucía Flores' },
    { remitente: 'r-g5', nombre: 'G5 · Bruno Mamani' },
    { remitente: 'r-h1', nombre: 'H1 · Ana Vargas' },
    { remitente: 'r-real', nombre: 'Cliente normal sin caso' },
    { remitente: 'r-null', nombre: null },
  ]

  it('solo incluye contactos con prefijo de caso', () => {
    const r = parsearEscenarios(contactos, new Map(), new Map())
    expect(r.map((e) => e.caso)).toEqual(['A1', 'B10', 'E1', 'G5', 'H1'])
    expect(r.find((e) => e.nombre.includes('normal'))).toBeUndefined()
  })

  it('ordena natural (A1 < B10, no alfabético)', () => {
    const muchos = [
      { remitente: '1', nombre: 'B2 · X Y' },
      { remitente: '2', nombre: 'B10 · X Y' },
      { remitente: '3', nombre: 'A1 · X Y' },
    ]
    expect(parsearEscenarios(muchos, new Map(), new Map()).map((e) => e.caso)).toEqual(['A1', 'B2', 'B10'])
  })

  it('cruza temperatura/score del pedido y el cierre', () => {
    const ped = new Map([['r-e1', { temperatura: 'caliente', score: 90, derivar: false, estado: 'nuevo' }]])
    const cie = new Map([['r-e1', { estado: 'ganado', tipo: 'venta' }]])
    const e1 = parsearEscenarios(contactos, ped, cie).find((e) => e.caso === 'E1')!
    expect(e1).toMatchObject({ nombre: 'Camila Rojas', temperatura: 'caliente', score: 90, cierre: 'ganado/venta' })
  })

  it('adjunta el título del escenario desde el catálogo', () => {
    const r = parsearEscenarios(contactos, new Map(), new Map())
    expect(r.find((e) => e.caso === 'E1')!.titulo).toBe('Venta auto (cierre_auto ON)')
    expect(r.find((e) => e.caso === 'A1')!.titulo).toBe('Solo saludo')
  })

  it('expone demo_tokens y demo_turnos por chat (null si no se midió)', () => {
    const conTok = [{ remitente: 'r-e1', nombre: 'E1 · Camila Rojas', demo_tokens: 23891, demo_turnos: [{ msg: 'Hola', tokens: 0 }, { msg: '¿tienen X?', tokens: 5700 }] }]
    const r = parsearEscenarios(conTok, new Map(), new Map())[0]
    expect(r.tokens).toBe(23891)
    expect(r.turnos).toHaveLength(2)
    expect(r.turnos![1]).toEqual({ msg: '¿tienen X?', tokens: 5700 })
    expect(parsearEscenarios(contactos, new Map(), new Map())[0].turnos).toBeNull()
  })

  it('marca derivado (por estado o flag) y atención (pausado)', () => {
    const ped = new Map([['r-g5', { temperatura: 'caliente', score: 70, derivar: true, estado: 'derivado' }]])
    const r = parsearEscenarios(contactos, ped, new Map(), new Set(['r-h1']))
    expect(r.find((e) => e.caso === 'G5')!.derivado).toBe(true)
    expect(r.find((e) => e.caso === 'H1')!.enAtencion).toBe(true)
  })
})
