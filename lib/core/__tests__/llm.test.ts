import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { withRetry } from '../llm'

const Schema = z.object({ ok: z.boolean() })

describe('withRetry', () => {
  it('devuelve el valor validado al primer intento', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true })
    const r = await withRetry(fn, Schema)
    expect(r.ok).toBe(true)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('reintenta una vez si la primera salida es inválida', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce({ ok: 'no-bool' })
      .mockResolvedValueOnce({ ok: false })
    const r = await withRetry(fn, Schema)
    expect(r.ok).toBe(false)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('lanza si los 3 intentos fallan', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: 'nope' })
    await expect(withRetry(fn, Schema)).rejects.toThrow()
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('reintenta también ante errores lanzados (LLM vacío / JSON inválido)', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('el LLM devolvió una respuesta vacía'))
      .mockResolvedValueOnce({ ok: true })
    const r = await withRetry(fn, Schema)
    expect(r.ok).toBe(true)
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
