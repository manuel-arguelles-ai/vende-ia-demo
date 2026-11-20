import type { PedidoGuardado } from './schemas'
import type { Cierre } from './gestion'

export type FiltrosPedidos = {
  desde?: string | null            // ISO; incluye pedidos con created_at >= desde
  hasta?: string | null            // ISO; incluye pedidos con created_at <= hasta
  estado?: 'nuevo' | 'derivado'    // estado del pedido
  tipo?: 'venta' | 'reserva' | 'sin' // tipo de cierre del lead ('sin' = lead sin cierre)
  tiendaId?: number                // tienda del cierre del lead
  texto?: string                   // busca en producto / número (remitente o _tel)
}

// Filtra pedidos cruzándolos con el cierre de su lead (por remitente) para los
// filtros de tipo (venta/reserva) y tienda. Puro y testeable; corre en el cliente.
export function filtrarPedidos(
  pedidos: PedidoGuardado[],
  cierrePorRem: Map<string, Cierre>,
  f: FiltrosPedidos,
): PedidoGuardado[] {
  const t = (f.texto ?? '').trim().toLowerCase()
  return pedidos.filter((p) => {
    if (f.desde && (p.created_at ?? '') < f.desde) return false
    if (f.hasta && (p.created_at ?? '') > f.hasta) return false
    if (f.estado && p.estado !== f.estado) return false
    const c = cierrePorRem.get(p.remitente)
    if (f.tipo === 'sin' && c?.tipo) return false
    if (f.tipo && f.tipo !== 'sin' && c?.tipo !== f.tipo) return false
    if (f.tiendaId != null && c?.tienda_id !== f.tiendaId) return false
    if (t) {
      const tel = ((p.extra as Record<string, unknown>)?._tel as string) ?? ''
      const hay = `${p.producto ?? ''} ${p.remitente} ${tel}`.toLowerCase()
      if (!hay.includes(t)) return false
    }
    return true
  })
}
