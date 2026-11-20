import type { Tienda } from './tiendas'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// Señales de forma de pago/recojo (se evalúan sobre el texto YA normalizado sin acentos).
const SENAL_VENTA = /\b(yape\w*|yapeame|plin\w*|transfer\w*|pago (ya|ahora|online|por yape|adelantad\w*)|ya pague|pago y recojo|recojo|recoger|paso a recoger|lo recojo)\b/
const SENAL_RESERVA = /\b(reserv\w*|apart\w*|separ\w*|pago en (la )?tienda|pagar (alla|en (la )?tienda)|pago al recoger|pago contra entrega)\b/
// El cliente PREGUNTA cómo/dónde pagar (aún no pagó) → no es señal de cierre.
const PREGUNTA_PAGO = /(a que (numero|cuenta)|que numero|como (te )?pago|donde (pago|deposito)|numero (de )?yape|yapeo\?|cuenta bancaria)/

/**
 * Detección DETERMINISTA del cierre (modo automático): dado el mensaje del cliente
 * (+ lo que el LLM haya propuesto en conv.cierre) y las tiendas, decide si el cliente
 * confirmó forma + tienda concreta. Devuelve {tipo, tiendaNombre} o null.
 * El guardrail (tienda existe, stock, no duplicar) lo aplica atender.
 */
export function detectarCierreAuto(
  textoCliente: string,
  convCierre: { tipo: 'venta' | 'reserva'; tienda: string } | null | undefined,
  tiendas: Tienda[],
): { tipo: 'venta' | 'reserva'; tiendaNombre: string } | null {
  if (!tiendas.length) return null
  const t = norm(textoCliente)
  if (PREGUNTA_PAGO.test(t)) return null // está preguntando cómo pagar, todavía no confirmó

  // ¿Menciona alguna tienda de la lista? (preferimos la propuesta por el LLM si coincide)
  const mencionada =
    (convCierre && tiendas.find((x) => norm(x.nombre) === norm(convCierre.tienda)))
    ?? tiendas.find((x) => t.includes(norm(x.nombre)))
  if (!mencionada) return null

  // Reserva tiene prioridad si hay señal explícita de apartar/pagar en tienda.
  if (SENAL_RESERVA.test(t)) return { tipo: 'reserva', tiendaNombre: mencionada.nombre }
  if (SENAL_VENTA.test(t)) return { tipo: 'venta', tiendaNombre: mencionada.nombre }
  // El LLM propuso un tipo y hay tienda mencionada → confiar en su tipo.
  if (convCierre) return { tipo: convCierre.tipo, tiendaNombre: mencionada.nombre }
  return null
}
