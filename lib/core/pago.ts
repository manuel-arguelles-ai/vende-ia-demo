// Verificación de comprobante de pago contra el total del pedido.
// El agente NO cierra si el monto pagado es menor (reclama la diferencia).
export function verificarPago(pagado: number, total: number, tolerancia = 0.1): { ok: boolean; falta: number } {
  const falta = Math.round((total - pagado) * 100) / 100
  return { ok: falta <= tolerancia, falta: Math.max(0, falta) }
}

// Marcador con el que se registra un comprobante en el chat (worker y harness):
// "[Comprobante de pago Yape: S/ X]" / "[Comprobante de pago Yape/Plin: S/ X]".
const RE_COMPROBANTE = /\[comprobante de pago[^\]]*s\/\s*([0-9]+(?:\.[0-9]+)?)\]/i

// Suma los montos de los comprobantes que el CLIENTE ya envió antes en la
// conversación, para acumular pagos parciales (pagó de menos y luego completa
// la diferencia con un segundo Yape). Solo cuenta mensajes del cliente.
export function pagosPrevios(historial: { rol: string; texto: string }[]): number {
  let suma = 0
  for (const t of historial) {
    if (t.rol !== 'cliente') continue
    const m = t.texto.match(RE_COMPROBANTE)
    if (m) suma += Number(m[1])
  }
  return Math.round(suma * 100) / 100
}
