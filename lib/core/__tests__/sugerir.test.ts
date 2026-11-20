import { describe, it, expect, vi } from 'vitest'
import { sugerirRespuestas } from '../sugerir'
import { resumenNegocio } from '../negocio'

describe('sugerirRespuestas', () => {
  it('genera 3 borradores con el contexto y los datos del negocio en el prompt', async () => {
    const fakeChat = vi.fn().mockResolvedValue({
      sugerencias: [
        { intencion: 'responder', texto: 'El café Gourmet está a S/25.' },
        { intencion: 'objecion', texto: 'Es tostado artesanal, rinde más que el comercial.' },
        { intencion: 'cierre', texto: '¿Te aparto uno? Puedes yapear al 999.' },
      ],
    })
    const r = await sugerirRespuestas(
      {
        historial: [
          { rol: 'cliente', texto: 'tienen café?' },
          { rol: 'bot', texto: 'Sí, Gourmet a S/25' },
        ],
        negocio: { yape: '999', titular: 'Titular Demo' },
        producto: 'café orgánico',
      },
      fakeChat,
    )
    expect(r.sugerencias).toHaveLength(3)
    expect(r.sugerencias.map((s) => s.intencion)).toEqual(['responder', 'objecion', 'cierre'])
    const user = (fakeChat.mock.calls[0][0] as { user: string }).user
    expect(user).toContain('tienen café?')
    expect(user).toContain('Yape: 999')
    expect(user).toContain('café orgánico')
  })

  it('sin datos del negocio avisa al modelo que no invente datos de pago', async () => {
    const fakeChat = vi.fn().mockResolvedValue({
      sugerencias: [{ intencion: 'cierre', texto: '¿Lo confirmamos?' }],
    })
    await sugerirRespuestas({ historial: [], negocio: {}, producto: null }, fakeChat)
    const user = (fakeChat.mock.calls[0][0] as { user: string }).user
    expect(user).toContain('no inventes datos de pago')
  })
})

describe('filtro anti-invención', () => {
  it('descarta borradores con teléfonos/cuentas que no están en el contexto', async () => {
    const fakeChat = vi.fn().mockResolvedValue({
      sugerencias: [
        { intencion: 'responder', texto: 'El café está a S/25.' },
        { intencion: 'cierre', texto: 'Yapea al 987654321 y listo.' }, // inventado
      ],
    })
    const r = await sugerirRespuestas({ historial: [], negocio: {}, producto: null }, fakeChat)
    expect(r.sugerencias).toHaveLength(1)
    expect(r.sugerencias[0].texto).not.toContain('987654321')
  })

  it('acepta números que SÍ están en los datos del negocio', async () => {
    const fakeChat = vi.fn().mockResolvedValue({
      sugerencias: [{ intencion: 'cierre', texto: 'Yapea al 900000001 (Titular Demo).' }],
    })
    const r = await sugerirRespuestas({ historial: [], negocio: { yape: '900000001' }, producto: null }, fakeChat)
    expect(r.sugerencias[0].texto).toContain('900000001')
  })
})

describe('resumenNegocio', () => {
  it('arma el resumen solo con los campos presentes', () => {
    const r = resumenNegocio({ yape: '999', banco: 'BCP', cuenta: '123', titular: 'M' })
    expect(r).toContain('Yape: 999')
    expect(r).toContain('Cuenta BCP: 123')
    expect(r).not.toContain('Plin')
  })
})
