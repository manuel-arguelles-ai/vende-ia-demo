import { chatJson, withRetry, type ChatJson } from './llm'
import { ScoringSchema, type Scoring, type Pedido } from './schemas'

const SYSTEM = `Sos un analista de ventas. Evaluás la intención de compra de un cliente de una tienda online.
Devolvé SOLO un objeto JSON con:
- temperatura: "caliente" | "tibio" | "frio"
- score: entero 0-100 (probabilidad de compra)
- razon: string corto explicando por qué
Señales de caliente: pregunta precio/stock/forma de pago, da datos de envío, muestra urgencia, dice "lo quiero".
Señales de frio: solo curiosea, no concreta, pregunta genérico.`

export async function puntuar(
  mensaje: string,
  pedido: Pedido,
  chat: ChatJson = chatJson,
): Promise<Scoring> {
  const user = `Mensaje del cliente: """${mensaje}"""
Pedido estructurado: ${JSON.stringify(pedido)}`
  return withRetry(() => chat({ system: SYSTEM, user }), ScoringSchema)
}
