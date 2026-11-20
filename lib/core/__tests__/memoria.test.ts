import { describe, it, expect, vi } from 'vitest'
import { quizasResumir } from '../memoria'

// Mock encadenable: select/eq/order → self; limit → mensajes; maybeSingle → resumen previo; upsert ok.
function dbConTurnos(n: number, resumenPrevio: { resumen: string; turnos_resumidos: number } | null = null) {
  const turnos = Array.from({ length: n }, (_, i) => ({ rol: 'cliente', texto: `m${i}` }))
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const b: Record<string, unknown> = {
    select: () => b, eq: () => b, order: () => b,
    limit: () => Promise.resolve({ data: [...turnos].reverse(), error: null }),
    maybeSingle: () => Promise.resolve({ data: resumenPrevio, error: null }),
    upsert,
  }
  return { db: { from: () => b } as never, upsert }
}

describe('quizasResumir', () => {
  it('pocos turnos → no resume', async () => {
    const resumir = vi.fn()
    const { db } = dbConTurnos(10)
    await quizasResumir('x', 6, db, resumir)
    expect(resumir).not.toHaveBeenCalled()
  })
  it('muchos turnos → resume lo viejo (total - VENTANA)', async () => {
    const resumir = vi.fn().mockResolvedValue('resumen ventas')
    const { db, upsert } = dbConTurnos(45)
    await quizasResumir('x', 6, db, resumir)
    expect(resumir).toHaveBeenCalled()
    const [antiguos] = resumir.mock.calls[0]
    expect(antiguos.length).toBe(45 - 20)
    expect(upsert).toHaveBeenCalled()
  })
  it('ya resumido recientemente (lote no alcanzado) → no re-resume', async () => {
    const resumir = vi.fn()
    const { db } = dbConTurnos(45, { resumen: 'x', turnos_resumidos: 24 }) // hasta=25, 25-24<10
    await quizasResumir('x', 6, db, resumir)
    expect(resumir).not.toHaveBeenCalled()
  })
})
