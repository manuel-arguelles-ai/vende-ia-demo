import { describe, it, expect } from 'vitest'
import { hashPassword, verificarPassword } from '../auth'
import { firmarSesion, sesionValida } from '../sesion'

describe('password (scrypt)', () => {
  it('verifica la clave correcta y rechaza la incorrecta', () => {
    const h = hashPassword('mi-clave-segura')
    expect(verificarPassword('mi-clave-segura', h)).toBe(true)
    expect(verificarPassword('otra-clave', h)).toBe(false)
  })

  it('rechaza hash ausente o malformado', () => {
    expect(verificarPassword('x', undefined)).toBe(false)
    expect(verificarPassword('x', 'basura')).toBe(false)
  })
})

describe('sesión (HMAC)', () => {
  const payload = { usuarioId: 1, tenantId: 1, rol: 'admin' }

  it('firma y valida un token vigente', async () => {
    const t = await firmarSesion(payload, 'secreto')
    expect(await sesionValida(t, 'secreto')).toEqual(payload)
  })

  it('rechaza secreto distinto, token roto o ausente', async () => {
    const t = await firmarSesion(payload, 'secreto')
    expect(await sesionValida(t, 'otro')).toBeNull()
    expect(await sesionValida('abc.firma-falsa', 'secreto')).toBeNull()
    expect(await sesionValida(undefined, 'secreto')).toBeNull()
    expect(await sesionValida(t, '')).toBeNull()
  })
})
