import { z } from 'zod'
import { chatJson, withRetry, type ChatJson } from './llm'

export const ReformulacionSchema = z.object({
  hayMapeo: z.boolean(),
  terminos: z.array(z.string()).default([]),
  categoria: z.string().optional(),
})
export type Reformulacion = z.infer<typeof ReformulacionSchema>

const SYSTEM = `El cliente pidió algo que NO tiene match exacto en el catálogo. Tu tarea: mapear su pedido a temas/categorías que SÍ existen en el catálogo.
Devolvé SOLO JSON: {"hayMapeo": bool, "terminos": ["..."], "categoria": "..."}
- Si el pedido se relaciona con alguna categoría de la lista, hayMapeo=true, terminos=1-3 palabras de búsqueda DENTRO del catálogo, categoria=la más cercana.
- Sabés mapear marcas/editoriales/autores a temas (ej. O'Reilly → programación/ingeniería).
- Si NO se relaciona con NADA de la lista, hayMapeo=false y terminos=[].
- No inventes productos; solo términos/categorías que encajen con la lista dada.`

export async function reformularConsulta(
  input: { consulta: string; categorias: string[] },
  chat: ChatJson = chatJson,
): Promise<Reformulacion> {
  if (!input.consulta.trim() || input.categorias.length === 0) return { hayMapeo: false, terminos: [] }
  const user = `Pedido del cliente: "${input.consulta}"\nCategorías reales del catálogo: ${input.categorias.join(', ')}`
  try {
    return await withRetry(() => chat({ system: SYSTEM, user }), ReformulacionSchema)
  } catch {
    return { hayMapeo: false, terminos: [] }
  }
}
