import { describe, it, expect, vi } from 'vitest'
import { registrarAlertaFraude } from '../alertas'

describe('registrarAlertaFraude', () => {
  it('inserta con tenant/autor/numero', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const db = { from: () => ({ insert }) } as never
    await registrarAlertaFraude({ tenantId: 6, remitente: 'x@s', autor: 'asesor', texto: 'yapeame 911', numero: '911' }, db)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: 6, autor: 'asesor', numero_detectado: '911' }))
  })
  it('fail-open: no lanza si el insert falla', async () => {
    const db = { from: () => ({ insert: vi.fn().mockResolvedValue({ error: { message: 'x' } }) }) } as never
    await expect(registrarAlertaFraude({ tenantId: 6, remitente: 'x', autor: 'bot', texto: 't' }, db)).resolves.toBeUndefined()
  })
})
