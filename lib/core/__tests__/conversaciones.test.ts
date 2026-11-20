import { describe, it, expect } from 'vitest'
import { agruparConversaciones, type MensajeRow, type PedidoLite } from '../conversaciones'

const msgs: MensajeRow[] = [
  // cliente A — dos turnos
  { remitente: 'A@s.whatsapp.net', rol: 'cliente', texto: 'hola', etapa: null, created_at: '2026-06-10T10:00:00Z' },
  { remitente: 'A@s.whatsapp.net', rol: 'bot', texto: '¡Hola! 🌱', etapa: 'enganche', created_at: '2026-06-10T10:00:05Z' },
  // cliente B — más reciente
  { remitente: 'B@s.whatsapp.net', rol: 'cliente', texto: 'lo quiero', etapa: null, created_at: '2026-06-10T11:00:00Z' },
  { remitente: 'B@s.whatsapp.net', rol: 'bot', texto: 'Te deriva un asesor', etapa: 'derivacion', created_at: '2026-06-10T11:00:05Z' },
]

// pedidos del más nuevo al más viejo (como vienen de la BD)
const pedidos: PedidoLite[] = [
  { remitente: 'B@s.whatsapp.net', temperatura: 'caliente', score: 90, derivar: true, producto: null, estado: 'derivado', extra: { zona: 'SJL', _tel: '51987654321@s.whatsapp.net' }, created_at: '2026-06-10T11:00:05Z' },
  { remitente: 'B@s.whatsapp.net', temperatura: 'tibio', score: 50, derivar: false, producto: 'quinoa', estado: 'nuevo', extra: null, created_at: '2026-06-10T11:00:00Z' },
  { remitente: 'A@s.whatsapp.net', temperatura: 'frio', score: 10, derivar: false, producto: null, estado: 'nuevo', extra: null, created_at: '2026-06-10T10:00:05Z' },
]

describe('agruparConversaciones', () => {
  it('agrupa los mensajes por remitente', () => {
    const convs = agruparConversaciones(msgs, pedidos)
    expect(convs).toHaveLength(2)
    expect(convs.find((c) => c.remitente === 'A@s.whatsapp.net')!.turnos).toHaveLength(2)
  })

  it('ordena las conversaciones por actividad más reciente primero', () => {
    const convs = agruparConversaciones(msgs, pedidos)
    expect(convs[0].remitente).toBe('B@s.whatsapp.net')
  })

  it('ordena los turnos cronológicamente dentro de cada conversación', () => {
    const convs = agruparConversaciones(msgs, pedidos)
    const a = convs.find((c) => c.remitente === 'A@s.whatsapp.net')!
    expect(a.turnos[0].texto).toBe('hola')
    expect(a.turnos[1].rol).toBe('bot')
  })

  it('usa la temperatura/score/etapa del último pedido', () => {
    const convs = agruparConversaciones(msgs, pedidos)
    const b = convs.find((c) => c.remitente === 'B@s.whatsapp.net')!
    expect(b.temperatura).toBe('caliente')
    expect(b.score).toBe(90)
    expect(b.etapa).toBe('derivacion')
    expect(b.derivado).toBe(true)
  })

  it('toma el producto más reciente que NO sea null', () => {
    const convs = agruparConversaciones(msgs, pedidos)
    const b = convs.find((c) => c.remitente === 'B@s.whatsapp.net')!
    expect(b.producto).toBe('quinoa')
  })

  it('extrae la zona del blob extra del último pedido', () => {
    const convs = agruparConversaciones(msgs, pedidos)
    const b = convs.find((c) => c.remitente === 'B@s.whatsapp.net')!
    expect(b.zona).toBe('SJL')
  })

  it('muestra el teléfono real (extra._tel) en vez del LID/remitente', () => {
    const convs = agruparConversaciones(
      [{ remitente: '999@lid', rol: 'cliente', texto: 'hola', etapa: null, created_at: '2026-06-10T10:00:00Z' }],
      [{ remitente: '999@lid', temperatura: 'caliente', score: 80, derivar: true, producto: null, estado: 'derivado', extra: { _tel: '51987654321@s.whatsapp.net' }, created_at: '2026-06-10T10:00:00Z' }],
    )
    expect(convs[0].numero).toBe('51987654321')
  })

  it('expone el número limpio y nulls cuando no hay pedido', () => {
    const convs = agruparConversaciones(
      [{ remitente: '51999@s.whatsapp.net', rol: 'cliente', texto: 'hi', etapa: null, created_at: '2026-06-10T10:00:00Z' }],
      [],
    )
    expect(convs[0].numero).toBe('51999')
    expect(convs[0].temperatura).toBeNull()
    expect(convs[0].producto).toBeNull()
    expect(convs[0].zona).toBeNull()
    expect(convs[0].derivado).toBe(false)
  })
})
