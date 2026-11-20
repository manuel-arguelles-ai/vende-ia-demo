import { describe, it, expect, vi } from 'vitest'
import { notificarAdmin } from '../notificarAdmin'

function sesionConectada() {
  const sendMessage = vi.fn().mockResolvedValue(undefined)
  const sesiones = new Map<number, { sock: { sendMessage: typeof sendMessage }; connected: boolean }>()
  sesiones.set(1, { sock: { sendMessage }, connected: true })
  return { sesiones, sendMessage }
}

const ADMIN = '51999@s.whatsapp.net'

describe('notificarAdmin', () => {
  it('envía el texto al admin por la sesión del tenant 1', async () => {
    const { sesiones, sendMessage } = sesionConectada()
    const r = await notificarAdmin(sesiones, ADMIN, 'hola')
    expect(r.ok).toBe(true)
    expect(sendMessage).toHaveBeenCalledWith(ADMIN, { text: 'hola' })
  })

  it('no hace nada si no hay admin jid', async () => {
    const { sesiones, sendMessage } = sesionConectada()
    const r = await notificarAdmin(sesiones, null, 'hola')
    expect(r.ok).toBe(false)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('no hace nada si el texto está vacío', async () => {
    const { sesiones, sendMessage } = sesionConectada()
    const r = await notificarAdmin(sesiones, ADMIN, '   ')
    expect(r.ok).toBe(false)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('ok:false si el tenant 1 no está conectado', async () => {
    const sendMessage = vi.fn()
    const sesiones = new Map([[1, { sock: { sendMessage }, connected: false }]])
    const r = await notificarAdmin(sesiones, ADMIN, 'hola')
    expect(r.ok).toBe(false)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('ok:false si no existe sesión del tenant 1', async () => {
    const sesiones = new Map()
    const r = await notificarAdmin(sesiones, ADMIN, 'hola')
    expect(r.ok).toBe(false)
  })

  it('fail-open si sendMessage lanza', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('x'))
    const sesiones = new Map([[1, { sock: { sendMessage }, connected: true }]])
    const r = await notificarAdmin(sesiones, ADMIN, 'hola')
    expect(r.ok).toBe(false)
  })
})
