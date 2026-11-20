import { describe, it, expect, vi } from 'vitest'
import { extraer } from '../extraer'

describe('extraer', () => {
  it('estructura un pedido a partir del mensaje', async () => {
    const fakeChat = vi.fn().mockResolvedValue({
      producto: 'polera', color: 'roja', talla: 'M', cantidad: 1,
      extra: {}, necesita_aclaracion: false,
    })
    const pedido = await extraer('polera roja M 35', [], fakeChat)
    expect(pedido.producto).toBe('polera')
    expect(pedido.necesita_aclaracion).toBe(false)
    // el mensaje del usuario debe ir en el prompt
    expect(fakeChat).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.stringContaining('polera roja M 35') }),
      undefined,
    )
  })

  it('marca necesita_aclaracion cuando faltan datos', async () => {
    const fakeChat = vi.fn().mockResolvedValue({
      producto: 'polera', color: null, talla: null, cantidad: null,
      extra: {}, necesita_aclaracion: true,
    })
    const pedido = await extraer('quiero una polera', [], fakeChat)
    expect(pedido.necesita_aclaracion).toBe(true)
    expect(pedido.talla).toBeNull()
  })

  it('incluye el contexto conversacional en el prompt para resolver referencias', async () => {
    const fakeChat = vi.fn().mockResolvedValue({
      producto: 'kombucha', color: null, talla: null, cantidad: 1,
      extra: {}, necesita_aclaracion: false,
    })
    const contexto = [
      { rol: 'cliente' as const, texto: 'tienen kombucha?' },
      { rol: 'bot' as const, texto: 'Sí, Tayta Kombucha a S/60' },
    ]
    await extraer('quiero solo una', contexto, fakeChat)
    expect(fakeChat).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.stringContaining('CONTEXTO') }),
      undefined,
    )
    expect(fakeChat).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.stringContaining('tienen kombucha?') }),
      undefined,
    )
  })

  it('el prompt instruye capturar necesidades descriptivas como producto', async () => {
    const fakeChat = vi.fn().mockResolvedValue({
      producto: 'algo natural para dormir', color: null, talla: null, cantidad: null,
      extra: {}, necesita_aclaracion: false,
    })
    const pedido = await extraer('busco algo natural para dormir mejor', [], fakeChat)
    expect(pedido.producto).toBe('algo natural para dormir')
    expect(fakeChat.mock.calls[0][0].system).toContain('necesidad')
  })

  it('sin contexto no agrega bloque CONTEXTO', async () => {
    const fakeChat = vi.fn().mockResolvedValue({
      producto: 'gin', color: null, talla: null, cantidad: null,
      extra: {}, necesita_aclaracion: false,
    })
    await extraer('gin', [], fakeChat)
    const user = fakeChat.mock.calls[0][0].user as string
    expect(user).not.toContain('CONTEXTO')
  })
})
