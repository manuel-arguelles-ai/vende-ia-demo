// Helpers de presentación del lead (solo display, no tocan datos ni negocio).
// Centralizados para no repetir bugs de formateo entre la card del board, el
// header del detalle y la ficha del panel lateral.

// Teléfono con un solo "+" y espaciado consistente ("+51 977 100 050").
// IDEMPOTENTE: normaliza al mismo resultado venga como venga la entrada
// ("+51…", "++51…", "0051…", "51…" o "+51 977 100 050" ya formateado).
// Si el valor tiene letras (LID/session, no es teléfono) se devuelve tal cual;
// los callers deben pasar el número ya resuelto (p. ej. jidANumero(...)).
export function telefonoLead(raw: string): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  if (/[a-zA-Z]/.test(s)) return s // no es teléfono: no lo tocamos
  let digits = s.replace(/\D/g, '') // quita "+", espacios, guiones, paréntesis…
  if (!digits) return ''
  if (digits.startsWith('00')) digits = digits.slice(2) // prefijo internacional "00"
  // Perú local sin prefijo: 9 dígitos que empiezan en 9 (celular) → anteponer 51.
  if (digits.length === 9 && digits.startsWith('9')) digits = '51' + digits
  // Perú (51 + 9 dígitos) → agrupado 3-3-3.
  if (digits.startsWith('51') && digits.length === 11) {
    const n = digits.slice(2)
    return `+51 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
  }
  return '+' + digits
}

// Los contactos demo llevan el código del escenario como prefijo del nombre
// ("E2 · Camila Rojas"). Lo separamos para atenuar el código y resaltar el
// nombre real (mismo patrón que superadmin-detalle.RE_CASO).
const RE_CODIGO = /^([A-Z][0-9]+) · (.+)$/
export function partirNombre(nombre: string | null | undefined): { codigo: string | null; nombre: string } {
  if (!nombre) return { codigo: null, nombre: '' }
  const m = nombre.match(RE_CODIGO)
  return m ? { codigo: m[1], nombre: m[2] } : { codigo: null, nombre }
}

// Iniciales (hasta 2) a partir del nombre real (ya sin código).
export function inicialesLead(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase()
}

// Categoría visual de una etiqueta según su texto (solo estilo).
export type CategoriaEtiqueta = 'pago' | 'entrega' | 'gris'
export function categoriaEtiqueta(txt: string): CategoriaEtiqueta {
  const t = txt.toLowerCase()
  if (/yape|plin|transferenc|cuenta|cci|pago|efectivo|tarjeta/.test(t)) return 'pago'
  if (/recojo|recoge|tienda|delivery|env[íi]o|entrega|despacho|reparto/.test(t)) return 'entrega'
  return 'gris'
}

// Clases por categoría (compartidas entre la card del board y la ficha lateral).
export const CLASES_CATEGORIA: Record<CategoriaEtiqueta, string> = {
  pago: 'bg-[#E1F5EE] text-[#0F6E56]',
  entrega: 'bg-[#EEEDFE] text-[#3C3489]',
  gris: 'bg-paper-2 text-muted',
}
