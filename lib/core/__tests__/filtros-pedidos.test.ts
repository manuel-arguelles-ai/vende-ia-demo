import { describe, it, expect } from 'vitest'
import { filtrarPedidos } from '../filtros-pedidos'
import type { PedidoGuardado } from '../schemas'
import type { Cierre } from '../gestion'

const ped = (over: Partial<PedidoGuardado>): PedidoGuardado => ({
  producto: 'aceite', color: null, talla: null, cantidad: 1, extra: {}, necesita_aclaracion: false,
  temperatura: 'tibio', score: 50, razon: '', canal: 'whatsapp', remitente: 'a@s',
  mensaje_crudo: '', derivar: false, estado: 'nuevo', created_at: '2026-06-20T10:00:00Z', ...over,
})

const PEDIDOS = [
  ped({ remitente: 'a@s', producto: 'aceite de coco', created_at: '2026-06-28T10:00:00Z', estado: 'derivado' }),
  ped({ remitente: 'b@s', producto: 'kombucha', created_at: '2026-06-10T10:00:00Z' }),
  ped({ remitente: 'c@s', producto: 'gin', created_at: '2026-06-27T10:00:00Z' }),
]
const cierres = new Map<string, Cierre>([
  ['a@s', { estado: 'ganado', monto: 50, tipo: 'venta', tienda_id: 1 }],
  ['c@s', { estado: 'reservada', monto: 30, tipo: 'reserva', tienda_id: 2 }],
])

describe('filtrarPedidos', () => {
  it('sin filtros → todos', () => {
    expect(filtrarPedidos(PEDIDOS, cierres, {})).toHaveLength(3)
  })
  it('fecha desde', () => {
    const r = filtrarPedidos(PEDIDOS, cierres, { desde: '2026-06-15T00:00:00Z' })
    expect(r.map((p) => p.remitente)).toEqual(['a@s', 'c@s'])
  })
  it('rango desde-hasta', () => {
    const r = filtrarPedidos(PEDIDOS, cierres, { desde: '2026-06-26T00:00:00Z', hasta: '2026-06-28T00:00:00Z' })
    expect(r.map((p) => p.remitente)).toEqual(['c@s']) // solo el del 27; a@s es del 28T10 (> hasta)
  })
  it('estado derivado', () => {
    expect(filtrarPedidos(PEDIDOS, cierres, { estado: 'derivado' }).map((p) => p.remitente)).toEqual(['a@s'])
  })
  it('tipo venta', () => {
    expect(filtrarPedidos(PEDIDOS, cierres, { tipo: 'venta' }).map((p) => p.remitente)).toEqual(['a@s'])
  })
  it('tipo reserva', () => {
    expect(filtrarPedidos(PEDIDOS, cierres, { tipo: 'reserva' }).map((p) => p.remitente)).toEqual(['c@s'])
  })
  it('tipo sin cierre', () => {
    expect(filtrarPedidos(PEDIDOS, cierres, { tipo: 'sin' }).map((p) => p.remitente)).toEqual(['b@s'])
  })
  it('tienda', () => {
    expect(filtrarPedidos(PEDIDOS, cierres, { tiendaId: 2 }).map((p) => p.remitente)).toEqual(['c@s'])
  })
  it('texto por producto', () => {
    expect(filtrarPedidos(PEDIDOS, cierres, { texto: 'kombu' }).map((p) => p.remitente)).toEqual(['b@s'])
  })
  it('combinado: venta + fecha reciente', () => {
    expect(filtrarPedidos(PEDIDOS, cierres, { tipo: 'venta', desde: '2026-06-15T00:00:00Z' })).toHaveLength(1)
  })
})
