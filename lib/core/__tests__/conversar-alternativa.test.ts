import { describe, it, expect, vi } from 'vitest'
import { conversar } from '../conversar'

const reply = { respuesta: 'ok', etapa: 'enganche', score: 10, razon: '', derivar: false, handoff: null, etiquetas: [], temperatura: 'frio' }

describe('conversar alternativaDe', () => {
  it('incluye el bloque de alternativa en el user', async () => {
    const chat = vi.fn().mockResolvedValue(reply)
    await conversar({ mensaje: 'oreilly', historial: [], matches: [], alternativaDe: "libros de O'Reilly" }, chat)
    const user = chat.mock.calls[0][0].user as string
    expect(user).toContain('ALTERNATIVA INFERIDA'); expect(user).toContain("O'Reilly")
  })
  it('sin alternativaDe no agrega el bloque', async () => {
    const chat = vi.fn().mockResolvedValue(reply)
    await conversar({ mensaje: 'hola', historial: [], matches: [] }, chat)
    expect(chat.mock.calls[0][0].user).not.toContain('ALTERNATIVA INFERIDA')
  })
})
