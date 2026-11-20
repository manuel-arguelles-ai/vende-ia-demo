import { PLANES } from './plataforma'

// gemini-2.5-flash: multimodal con free tier disponible para nuestra key
// (gemini-2.0-flash tiene limit:0 en free tier para este proyecto).
const MODELO = 'gemini-2.5-flash'
const PROMPT =
  'Describí en una sola frase el producto que aparece en esta foto, para buscarlo en un catálogo de una tienda: ' +
  'tipo de producto, color, marca y cualquier texto visible. Respondé solo la descripción del producto, sin saludos ni explicaciones.'

/**
 * Describe el producto de una imagen con Gemini (multimodal). Best-effort:
 * devuelve null sin GEMINI_API_KEY o ante cualquier error/timeout.
 */
export async function describirImagen(
  buf: Buffer,
  mimetype: string,
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  try {
    const res = await fetchFn(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inlineData: { mimeType: mimetype, data: buf.toString('base64') } },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    return texto && texto.length > 0 ? texto : null
  } catch {
    return null
  }
}

// Interpreta una imagen distinguiendo COMPROBANTE DE PAGO (Yape/Plin/transferencia) de
// FOTO DE PRODUCTO. Para pagos extrae monto/titular/operación (para verificar el cierre).
export type ImagenInterpretada =
  | { tipo: 'pago'; monto: number | null; titular: string | null; operacion: string | null }
  | { tipo: 'producto'; descripcion: string }

const PROMPT_INTERPRETAR =
  'Mirá esta imagen de un chat de ventas. Si es una CONSTANCIA/COMPROBANTE DE PAGO ' +
  '(Yape, Plin, transferencia bancaria: muestra un monto pagado, "Yapeaste", n° de operación, etc.), ' +
  'devolvé JSON {"tipo":"pago","monto":<número del monto en soles, solo el número p.ej. 45.30>,' +
  '"titular":"<a quién/para quién se pagó>","operacion":"<n° de operación o null>"}. ' +
  'Si es una FOTO DE UN PRODUCTO, devolvé {"tipo":"producto","descripcion":"<tipo, marca, texto visible en una frase>"}. ' +
  'Respondé SOLO el JSON.'

export async function interpretarImagen(
  buf: Buffer,
  mimetype: string,
  fetchFn: typeof fetch = fetch,
): Promise<ImagenInterpretada | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  try {
    const res = await fetchFn(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT_INTERPRETAR }, { inlineData: { mimeType: mimetype, data: buf.toString('base64') } }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!txt) return null
    const o = JSON.parse(txt) as { tipo?: string; monto?: unknown; titular?: unknown; operacion?: unknown; descripcion?: unknown }
    if (o.tipo === 'pago') {
      const m = typeof o.monto === 'number' ? o.monto : typeof o.monto === 'string' ? Number(String(o.monto).replace(/[^\d.]/g, '')) : NaN
      return { tipo: 'pago', monto: Number.isFinite(m) ? m : null, titular: (o.titular as string) ?? null, operacion: o.operacion ? String(o.operacion) : null }
    }
    return { tipo: 'producto', descripcion: typeof o.descripcion === 'string' ? o.descripcion : '' }
  } catch {
    return null
  }
}

export function planTieneVision(plan: string): boolean {
  const p = (PLANES as Record<string, { limites: { vision?: boolean } }>)[plan]
  return p?.limites?.vision ?? false
}
