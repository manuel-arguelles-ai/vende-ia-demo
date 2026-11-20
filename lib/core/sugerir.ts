import { z } from 'zod'
import { chatJson, withRetry, type ChatJson } from './llm'
import type { Turno } from './historial'
import { resumenNegocio, type DatosNegocio } from './negocio'

// Sugerencias de respuesta para el ASESOR HUMANO en takeover (next-best-action):
// 3 borradores con intención distinta que rellenan el composer sin enviarse.
// No es Nina: acá escribe el dueño del negocio, con sus datos reales a mano.

export const SugerenciasSchema = z.object({
  sugerencias: z
    .array(
      z.object({
        intencion: z.enum(['responder', 'objecion', 'cierre']),
        texto: z.string(),
      }),
    )
    .min(1)
    .max(3),
})
export type Sugerencias = z.infer<typeof SugerenciasSchema>

const SYSTEM = `Sos el ASESOR HUMANO de una tienda peruana de productos orgánicos, retomando una
conversación de WhatsApp que venía atendiendo el bot de ventas. Escribí 3 borradores de respuesta
para que el asesor elija y edite. Reglas:
- Tono: humano, cercano, peruano, directo. 1-2 frases por borrador (es WhatsApp). Sin markdown.
- Cada borrador con una intención distinta:
  1) "responder": contestar la última duda/mensaje del cliente con la info disponible.
  2) "objecion": destrabar la fricción más probable (precio, confianza, tiempos, pago).
  3) "cierre": pedir la venta con un paso concreto (confirmar pedido, coordinar pago/envío).
- Si DATOS DEL NEGOCIO trae Yape/Plin/cuenta y el contexto es de pago, usá los datos REALES.
- Si DATOS DEL NEGOCIO NO trae un dato (Yape, cuenta, delivery, promos), NO lo inventes ni menciones
  números/montos concretos: decí "te paso los datos de pago" o "te confirmo el delivery" y listo.
- NUNCA inventes precios, productos, números de teléfono, políticas ni promociones que no estén
  textualmente en la conversación o en DATOS DEL NEGOCIO.
- No te presentes como bot. Podés firmar como el asesor si suma.
Devolvé SOLO JSON: {"sugerencias":[{"intencion":"responder|objecion|cierre","texto":"..."}]}`

// Guardrail de código: descarta borradores con teléfonos/números largos que no
// existan en el contexto (el LLM a veces inventa "yapea al 987654321").
export function sinNumerosInventados(
  texto: string,
  contexto: string,
): boolean {
  const numeros = texto.match(/\d{6,}/g) ?? []
  return numeros.every((n) => contexto.includes(n))
}

export async function sugerirRespuestas(
  input: { historial: Turno[]; negocio: DatosNegocio; producto?: string | null },
  chat: ChatJson = chatJson,
): Promise<Sugerencias> {
  const historialTxt = input.historial
    .slice(-14)
    .map((t) => `${t.rol === 'cliente' ? 'Cliente' : t.rol === 'asesor' ? 'Asesor' : 'Bot'}: ${t.texto}`)
    .join('\n')
  const negocioTxt = resumenNegocio(input.negocio) || '(sin datos cargados — no inventes datos de pago)'

  const user = `CONVERSACIÓN (últimos mensajes):
${historialTxt}

PRODUCTO EN FOCO: ${input.producto ?? 'desconocido'}

DATOS DEL NEGOCIO:
${negocioTxt}`

  const r = await withRetry(() => chat({ system: SYSTEM, user }), SugerenciasSchema)
  // Filtro anti-invención: un número largo (teléfono/cuenta) solo es válido si
  // aparece en la conversación o en los datos del negocio.
  const contexto = `${historialTxt}\n${negocioTxt}`
  const limpias = r.sugerencias.filter((s) => sinNumerosInventados(s.texto, contexto))
  return { sugerencias: limpias.length ? limpias : r.sugerencias.map((s) => ({ ...s, texto: s.texto.replace(/\d{6,}/g, '____') })) }
}
