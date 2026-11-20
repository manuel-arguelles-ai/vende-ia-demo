import { describe, it, expect, vi } from 'vitest'
import { conversar } from '../conversar'

const reply = { respuesta: 'ok', etapa: 'enganche', score: 10, razon: '', derivar: false, handoff: null, etiquetas: [], temperatura: 'frio' }

describe('conversar resumenPrevio', () => {
  it('incluye el bloque de resumen', async () => {
    const chat = vi.fn().mockResolvedValue(reply)
    await conversar({ mensaje: 'sigo?', historial: [], matches: [], resumenPrevio: 'Ana quiere aceite, Surco' }, chat)
    expect(chat.mock.calls[0][0].user).toContain('RESUMEN DE LA CONVERSACIÓN PREVIA')
  })
  it('sin resumen no agrega el bloque', async () => {
    const chat = vi.fn().mockResolvedValue(reply)
    await conversar({ mensaje: 'hola', historial: [], matches: [] }, chat)
    expect(chat.mock.calls[0][0].user).not.toContain('RESUMEN DE LA CONVERSACIÓN PREVIA')
  })
})
