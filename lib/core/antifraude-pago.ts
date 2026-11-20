import type { DatosNegocio } from './negocio'

const KEYWORDS = /\b(yape[a-z]*|yap[ée]ame|plin[a-z]*|transfer[a-z]*|transfiere|deposit[ao]|dep[óo]sito|cuenta|cci|n[úu]mero de cuenta|a nombre de|bcp|bbva|interbank|scotiabank)\b/i

const soloDigitos = (s: string) => s.replace(/\D/g, '')

function configurados(n: DatosNegocio): Set<string> {
  const set = new Set<string>()
  for (const v of [n.yape, n.plin, n.cuenta, n.cci]) {
    const d = soloDigitos(v ?? '')
    if (d.length >= 6) set.add(d)
  }
  return set
}

// Detecta una forma de pago (Yape/Plin/cuenta/CCI) escrita en el texto que NO
// coincide con las configuradas. Solo dispara si hay keyword de pago en el texto
// (evita teléfonos de contacto). Ignora ISBN (13 díg 978/979) y precios cortos.
export function detectarPagoNoAutorizado(texto: string, negocio: DatosNegocio): { fraude: boolean; numero?: string } {
  if (!KEYWORDS.test(texto)) return { fraude: false }
  const ok = configurados(negocio)
  // candidatos: secuencias de ≥9 dígitos (permitiendo espacios/guiones/puntos internos)
  const matches = texto.match(/\d[\d\s.\-]{7,}\d/g) ?? []
  for (const m of matches) {
    const d = soloDigitos(m)
    if (d.length < 9) continue
    if (ok.has(d)) continue
    if (d.length === 13 && /^97[89]/.test(d)) continue // ISBN
    return { fraude: true, numero: d }
  }
  return { fraude: false }
}
