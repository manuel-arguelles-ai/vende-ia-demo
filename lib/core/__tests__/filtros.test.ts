import { describe, it, expect } from 'vitest'
import { filtrarConversaciones } from '../filtros'
import type { Conversacion } from '../conversaciones'

const AHORA = new Date('2026-06-12T12:00:00Z').getTime()
const hace = (h: number) => new Date(AHORA - h * 3600_000).toISOString()

function conv(p: Partial<Conversacion>): Conversacion {
  return {
    remitente: 'x@lid', numero: '51999', turnos: [], ultimoAt: hace(1),
    etapa: null, temperatura: 'tibio', score: 50, derivar: false, derivado: false,
    producto: null, zona: null, enAtencion: false, etiquetas: [],
    nombre: null, cierre: null, recordatorio: null, ...p,
  }
}

const convs: Conversacion[] = [
  conv({ remitente: 'a', numero: '51911111111', producto: 'kombucha', ultimoAt: hace(2), etiquetas: [{ etiqueta: 'mayorista', origen: 'manual' }] }),
  conv({ remitente: 'b', numero: '51922222222', producto: 'granola', ultimoAt: hace(50), turnos: [{ rol: 'cliente', texto: 'quiero factura por favor', etapa: null, created_at: hace(50) }] }),
  conv({ remitente: 'c', numero: '51933333333', zona: 'Callao', ultimoAt: hace(24 * 9) }),
]

describe('filtrarConversaciones', () => {
  it('sin filtros devuelve todo', () => {
    expect(filtrarConversaciones(convs, {}, AHORA)).toHaveLength(3)
  })

  it('busca por número, producto, zona, etiqueta y texto del chat', () => {
    expect(filtrarConversaciones(convs, { q: '51911' }, AHORA)[0].remitente).toBe('a')
    expect(filtrarConversaciones(convs, { q: 'granola' }, AHORA)[0].remitente).toBe('b')
    expect(filtrarConversaciones(convs, { q: 'callao' }, AHORA)[0].remitente).toBe('c')
    expect(filtrarConversaciones(convs, { q: 'mayorista' }, AHORA)[0].remitente).toBe('a')
    expect(filtrarConversaciones(convs, { q: 'factura' }, AHORA)[0].remitente).toBe('b')
    expect(filtrarConversaciones(convs, { q: 'inexistente' }, AHORA)).toHaveLength(0)
  })

  it('filtra por etiqueta exacta', () => {
    expect(filtrarConversaciones(convs, { etiqueta: 'mayorista' }, AHORA)).toHaveLength(1)
    expect(filtrarConversaciones(convs, { etiqueta: 'otra' }, AHORA)).toHaveLength(0)
  })

  it('filtra por última comunicación (presets)', () => {
    expect(filtrarConversaciones(convs, { ultima: '24h' }, AHORA).map((c) => c.remitente)).toEqual(['a'])
    expect(filtrarConversaciones(convs, { ultima: '3d' }, AHORA)).toHaveLength(2)
    expect(filtrarConversaciones(convs, { ultima: 'mas7d' }, AHORA).map((c) => c.remitente)).toEqual(['c'])
  })

  it('estado de venta: activos oculta cerrados; ganados/perdidos filtran', () => {
    const conCierre = [
      ...convs,
      conv({ remitente: 'g', numero: '51944444444', ultimoAt: hace(1), cierre: { estado: 'ganado', monto: 105 } }),
      conv({ remitente: 'p', numero: '51955555555', ultimoAt: hace(1), cierre: { estado: 'perdido', monto: null } }),
    ]
    expect(filtrarConversaciones(conCierre, {}, AHORA)).toHaveLength(3) // activos por defecto
    expect(filtrarConversaciones(conCierre, { estado: 'ganados' }, AHORA).map((c) => c.remitente)).toEqual(['g'])
    expect(filtrarConversaciones(conCierre, { estado: 'perdidos' }, AHORA).map((c) => c.remitente)).toEqual(['p'])
    expect(filtrarConversaciones(conCierre, { estado: 'todos' }, AHORA)).toHaveLength(5)
  })

  it('busca también por nombre del contacto', () => {
    const conNombre = [conv({ remitente: 'n', numero: '51966', nombre: 'Carlos', ultimoAt: hace(1) })]
    expect(filtrarConversaciones(conNombre, { q: 'carlos' }, AHORA)).toHaveLength(1)
  })

  it('combina filtros (AND)', () => {
    expect(filtrarConversaciones(convs, { q: 'kombucha', ultima: '24h' }, AHORA)).toHaveLength(1)
    expect(filtrarConversaciones(convs, { q: 'kombucha', ultima: 'mas7d' }, AHORA)).toHaveLength(0)
  })
})
