// Embedding de consultas y documentos para búsqueda híbrida (Gemini, 768 dims).
// Sin GEMINI_API_KEY, ante error o timeout devuelve null → buscarProductos cae a léxico puro.
const MODELO = 'gemini-embedding-001'

export type EmbedQuery = (texto: string) => Promise<number[] | null>

/**
 * Embebe un documento para indexación (RETRIEVAL_DOCUMENT).
 * Best-effort: devuelve null si no hay GEMINI_API_KEY o ante cualquier error.
 */
export async function embeberDocumento(texto: string): Promise<number[] | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key || !texto.trim()) return null
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:embedContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text: texto }] },
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: 768,
        }),
        signal: AbortSignal.timeout(2500),
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { embedding?: { values?: number[] } }
    return data.embedding?.values ?? null
  } catch {
    return null
  }
}

export async function embeberQuery(texto: string): Promise<number[] | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key || !texto.trim()) return null
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:embedContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text: texto }] },
          taskType: 'RETRIEVAL_QUERY',
          outputDimensionality: 768,
        }),
        signal: AbortSignal.timeout(2500),
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { embedding?: { values?: number[] } }
    return data.embedding?.values ?? null
  } catch {
    return null
  }
}
