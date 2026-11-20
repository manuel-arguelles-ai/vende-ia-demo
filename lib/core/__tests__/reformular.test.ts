import { describe, it, expect, vi } from 'vitest'
import { reformularConsulta } from '../reformular'

describe('reformularConsulta', () => {
  it('mapea a categorías reales', async () => {
    const chat = vi.fn().mockResolvedValue({ hayMapeo: true, terminos: ['programación', 'ingeniería'], categoria: 'Ingeniería' })
    const r = await reformularConsulta({ consulta: "libros de O'Reilly", categorias: ['Ingeniería', 'Novela'] }, chat)
    expect(r.hayMapeo).toBe(true); expect(r.terminos).toContain('programación')
  })
  it('sin relación → hayMapeo false', async () => {
    const chat = vi.fn().mockResolvedValue({ hayMapeo: false, terminos: [] })
    const r = await reformularConsulta({ consulta: 'zapatillas', categorias: ['Novela'] }, chat)
    expect(r.hayMapeo).toBe(false)
  })
  it('sin categorías → no llama al LLM', async () => {
    const chat = vi.fn()
    const r = await reformularConsulta({ consulta: 'x', categorias: [] }, chat)
    expect(r.hayMapeo).toBe(false); expect(chat).not.toHaveBeenCalled()
  })
  it('error del LLM → degrada a hayMapeo false', async () => {
    const chat = vi.fn().mockRejectedValue(new Error('x'))
    const r = await reformularConsulta({ consulta: 'x', categorias: ['Novela'] }, chat)
    expect(r.hayMapeo).toBe(false)
  })
})
