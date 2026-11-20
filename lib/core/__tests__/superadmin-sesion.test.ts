import { describe, it, expect } from 'vitest'
import { firmarSuperadmin, superadminValido } from '@/lib/superadmin-sesion'

const SECRET = 'test-secret-superadmin-32chars!!'

describe('firmarSuperadmin / superadminValido', () => {
  it('roundtrip válido: devuelve email y superadmin:true', async () => {
    const token = await firmarSuperadmin({ email: 'admin@example.com' }, SECRET)
    const resultado = await superadminValido(token, SECRET)
    expect(resultado).not.toBeNull()
    expect(resultado?.superadmin).toBe(true)
    expect(resultado?.email).toBe('admin@example.com')
  })

  it('firma manipulada → null', async () => {
    const token = await firmarSuperadmin({ email: 'admin@example.com' }, SECRET)
    const manipulado = token.slice(0, -4) + 'XXXX'
    const resultado = await superadminValido(manipulado, SECRET)
    expect(resultado).toBeNull()
  })

  it('token expirado → null', async () => {
    // firma en el pasado (hace 8 días)
    const haceOchoDias = Date.now() - 8 * 24 * 60 * 60 * 1000
    const token = await firmarSuperadmin({ email: 'admin@example.com' }, SECRET, haceOchoDias)
    const resultado = await superadminValido(token, SECRET)
    expect(resultado).toBeNull()
  })

  it('token undefined → null', async () => {
    expect(await superadminValido(undefined, SECRET)).toBeNull()
  })

  it('secret incorrecto → null', async () => {
    const token = await firmarSuperadmin({ email: 'admin@example.com' }, SECRET)
    expect(await superadminValido(token, 'otro-secret-diferente-32chars!!')).toBeNull()
  })
})
