import type { PedidoGuardado } from './schemas'
import type { ProductoMatch } from './catalogo'

function resumen(p: PedidoGuardado): string {
  const partes = [
    p.cantidad ? `${p.cantidad}x` : null,
    p.producto,
    p.color,
    p.talla ? `talla ${p.talla}` : null,
  ].filter(Boolean)
  return partes.length ? partes.join(' ') : 'tu pedido'
}

const soles = (precio: number) => `S/${Number(precio).toFixed(2)}`

export function respuestaPara(
  p: PedidoGuardado & { match?: ProductoMatch | null },
): string {
  if (p.necesita_aclaracion) {
    return '¡Hola! 🙌 ¿Qué producto estás buscando? Decímelo y te paso precio y disponibilidad.'
  }

  // Encontramos el producto en el catálogo → respondemos con precio + stock real.
  const m = p.match
  if (m) {
    const pres = m.presentacion ? ` (${m.presentacion})` : ''
    if (m.stock > 0) {
      const cierre = p.derivar
        ? ' Un asesor te confirma para cerrar la compra 🔥'
        : ' ¿Te lo reservo? 🙌'
      return `¡Sí! Tenemos ${m.nombre} a ${soles(m.precio)}${pres}. Quedan ${m.stock} en stock 📦.${cierre}`
    }
    return `Justo el ${m.nombre} está agotado por ahora 😕. ¿Querés que te muestre una alternativa similar?`
  }

  // Sin match en el catálogo → derivamos / acusamos.
  if (p.derivar) {
    return `¡Buenísimo! Anoté: ${resumen(p)}. Un asesor te contacta para cerrar la compra 🔥`
  }
  return `¡Anotado! ${resumen(p)}. ¿Te ayudo con algo más? 🙌`
}
