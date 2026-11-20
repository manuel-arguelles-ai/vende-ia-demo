import type { PedidoGuardado } from './schemas'

// "51900000002@s.whatsapp.net" → "51900000002" (descarta sufijo de dispositivo ":12").
export function jidANumero(jid: string): string {
  return jid.split('@')[0].split(':')[0]
}

// Teléfono real para mostrar/exportar. El `remitente` puede ser un LID opaco
// (direccionamiento nuevo de WhatsApp); el número real resuelto se guarda en
// `extra._tel`. Cae al remitente si no hay _tel.
export function telefonoMostrado(remitente: string, extra?: Record<string, unknown> | null): string {
  const tel = extra && typeof extra._tel === 'string' && extra._tel ? extra._tel : remitente
  return jidANumero(tel)
}

// Mensaje que recibe el asesor humano (el asesor) en su WhatsApp cuando un lead se pone caliente.
export function avisoHandoff(input: {
  remitente: string
  handoff: string | null
  saved: PedidoGuardado
  telefono?: string | null // jid/número real del cliente (el remitente puede ser un LID)
}): string {
  const numero = jidANumero(input.telefono ?? input.remitente)
  const { temperatura, score, producto } = input.saved
  const resumen = input.handoff?.trim() || 'Lead listo para cerrar.'
  const lineas = [
    '🔥 LEAD CALIENTE — vende-ia',
    '',
    `📝 ${resumen}`,
  ]
  if (producto) lineas.push(`🛒 Producto: ${producto}`)
  lineas.push(`🌡️ ${temperatura} · score ${score}/100`)
  lineas.push('', `📞 Cliente: +${numero}`, `💬 https://wa.me/${numero}`)
  return lineas.join('\n')
}
