import OpenAI from 'openai'
import type { z } from 'zod'

export type ChatArgs = { system: string; user: string }
// onUsage (opcional) recibe los tokens de cada llamada de red exitosa, para
// medición de consumo. No afecta el resultado parseado.
export type ChatJson = (args: ChatArgs, onUsage?: (tokens: number) => void) => Promise<unknown>

// Se leen dentro de las funciones (no a nivel de módulo) para que el env
// pueda setearse después del import (worker con dotenv, tests, swap en runtime).
function client(): OpenAI {
  const provider = process.env.LLM_PROVIDER ?? 'deepseek'
  if (provider === 'deepseek') {
    return new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY,
    })
  }
  if (provider === 'gemini') {
    // Gemini vía su endpoint OpenAI-compatible (soporta response_format json_object).
    return new OpenAI({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey: process.env.GEMINI_API_KEY,
    })
  }
  if (provider === 'groq') {
    return new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
    })
  }
  // OpenAI-compatible por defecto (permite swap a otros endpoints vía LLM_BASE_URL).
  return new OpenAI({ baseURL: process.env.LLM_BASE_URL, apiKey: process.env.OPENAI_API_KEY })
}

// Llamada de red: pide JSON y lo parsea. No se testea unitariamente.
export const chatJson: ChatJson = async ({ system, user }, onUsage) => {
  const res = await client().chat.completions.create({
    model: process.env.LLM_MODEL ?? 'deepseek-v4-pro',
    temperature: 0.2,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })
  // Medición de consumo (best-effort, ortogonal al parseo).
  if (onUsage) onUsage(res.usage?.total_tokens ?? 0)
  const text = res.choices[0]?.message?.content
  if (!text || !text.trim()) throw new Error('el LLM devolvió una respuesta vacía')
  return JSON.parse(text)
}

// Valida con Zod y reintenta (3 intentos, backoff corto): cubre JSON inválido,
// respuestas vacías transitorias del proveedor y fallos de schema.
export async function withRetry<T>(
  fn: () => Promise<unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return schema.parse(await fn())
    } catch (err) {
      lastError = err
      if (attempt < 2) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
    }
  }
  throw lastError
}
