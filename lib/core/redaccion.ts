// Redacción de PII para LOGS (no para el handoff legítimo al asesor).
export function redactarTexto(texto: string): string {
  if (!texto) return '[vacío]'
  const palabras = texto.trim().split(/\s+/).slice(0, 3).join(' ')
  const preview = palabras.length > 18 ? palabras.slice(0, 18) : palabras
  return `[${texto.length} chars: ${preview}…]`
}

export function redactarRemitente(remitente: string): string {
  const soloDigitos = remitente.replace(/\D/g, '')
  if (soloDigitos.length < 4) return '…'
  return `…${soloDigitos.slice(-4)}`
}
