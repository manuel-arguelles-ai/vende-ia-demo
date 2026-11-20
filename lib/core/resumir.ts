import { z } from 'zod'
import { chatJson, withRetry, type ChatJson } from './llm'
import type { Turno } from './historial'

// Resumen IA de la conversación: "ponete al día en 5 segundos" antes del
// takeover. Bullets cortos + siguiente paso sugerido.
export const ResumenSchema = z.object({
  puntos: z.array(z.string()).min(1).max(5),
  siguientePaso: z.string(),
})
export type Resumen = z.infer<typeof ResumenSchema>

const SYSTEM = `Resumí esta conversación de ventas por WhatsApp para el asesor humano que la va a retomar.
Devolvé SOLO JSON: {"puntos": ["..."], "siguientePaso": "..."}
- puntos: 2-4 bullets ultracortos con lo que importa para vender (qué quiere, cantidad, zona,
  objeciones, en qué quedó). Sin relleno.
- siguientePaso: la acción concreta que el asesor debería hacer ahora (1 frase).
- No inventes nada que no esté en la conversación.`

export async function resumirConversacion(
  historial: Turno[],
  chat: ChatJson = chatJson,
): Promise<Resumen> {
  const texto = historial
    .map((t) => `${t.rol === 'cliente' ? 'Cliente' : t.rol === 'asesor' ? 'Asesor' : 'Bot'}: ${t.texto}`)
    .join('\n')
  return withRetry(() => chat({ system: SYSTEM, user: texto || '(sin mensajes)' }), ResumenSchema)
}

// ─── Memoria de largo plazo: resumen rodante acumulativo para el prompt del bot ───
const ResumenMemSchema = z.object({ resumen: z.string() })

const SYSTEM_MEM = `Mantenés la MEMORIA de largo plazo de una conversación de ventas por WhatsApp.
Integrá el RESUMEN PREVIO (si hay) con los mensajes nuevos en UN resumen actualizado, conciso (máx ~120 palabras).
Devolvé SOLO JSON: {"resumen": "..."}
Incluí solo lo útil para vender: producto(s) de interés, cantidad, objeciones, datos del cliente (nombre/zona), estado del pedido, compromisos/pendientes.
No inventes nada que no esté en la conversación. Es memoria interna, no un mensaje al cliente.`

export async function resumirParaMemoria(
  turnos: Turno[], previo?: string, chat: ChatJson = chatJson,
): Promise<string> {
  const texto = turnos
    .map((t) => `${t.rol === 'cliente' ? 'Cliente' : t.rol === 'asesor' ? 'Asesor' : 'Bot'}: ${t.texto}`)
    .join('\n')
  const user = (previo ? `RESUMEN PREVIO:\n${previo}\n\n` : '') + `MENSAJES NUEVOS:\n${texto || '(sin mensajes)'}`
  const r = await withRetry(() => chat({ system: SYSTEM_MEM, user }), ResumenMemSchema)
  return r.resumen
}
