import { describe, it, expect, vi } from 'vitest'
import { resumirParaMemoria } from '../resumir'

describe('resumirParaMemoria', () => {
  it('integra previo + nuevos y devuelve string', async () => {
    const chat = vi.fn().mockResolvedValue({ resumen: 'Cliente Ana quiere aceite de coco, zona Surco.' })
    const r = await resumirParaMemoria([{ rol: 'cliente', texto: 'soy Ana de Surco' }], 'quería aceite', chat)
    expect(r).toContain('Ana')
    const user = chat.mock.calls[0][0].user as string
    expect(user).toContain('RESUMEN PREVIO'); expect(user).toContain('MENSAJES NUEVOS')
  })
})
