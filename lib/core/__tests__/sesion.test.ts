import { describe, it, expect } from 'vitest'
import { firmarSesion, sesionValida, SESION_DIAS, type SesionPayload } from '../../sesion'

const SECRET = 'test-secret-key-xyz'

const payload: SesionPayload = { usuarioId: 5, tenantId: 3, rol: 'admin' }

describe('sesion', () => {
  it('round-trip: firmar y validar devuelve el payload original', async () => {
    const ahora = Date.now()
    const token = await firmarSesion(payload, SECRET, ahora)
    const resultado = await sesionValida(token, SECRET, ahora)
    expect(resultado).toEqual(payload)
  })

  // Regresión: el b64url del claims puede caer en cualquier longitud mod 4 según
  // el payload (p.ej. rol 'asesor' vs 'admin' cambia la longitud). El decode debe
  // re-agregar el padding correcto en TODOS los casos, no solo cuando len%4==0.
  it('round-trip para payloads de longitudes variadas (asesor incluido)', async () => {
    const ahora = Date.now()
    const casos: SesionPayload[] = [
      { usuarioId: 11, tenantId: 6, rol: 'asesor' }, // el que fallaba en prod
      { usuarioId: 10, tenantId: 7, rol: 'admin' },
      { usuarioId: 1, tenantId: 1, rol: 'asesor' },
      { usuarioId: 123, tenantId: 456, rol: 'asesor' },
      { usuarioId: 9, tenantId: 99, rol: 'admin' },
      { usuarioId: 100, tenantId: 2000, rol: 'superadmin' },
    ]
    for (const p of casos) {
      const token = await firmarSesion(p, SECRET, ahora)
      const resultado = await sesionValida(token, SECRET, ahora)
      expect(resultado, `falló round-trip para ${JSON.stringify(p)}`).toEqual(p)
    }
  })

  it('token expirado → null', async () => {
    // Firmar con una fecha 31 días en el pasado (más de SESION_DIAS)
    const emision = Date.now() - (SESION_DIAS + 1) * 24 * 60 * 60 * 1000
    const token = await firmarSesion(payload, SECRET, emision)
    // Validar con el tiempo actual → el token ya expiró
    const resultado = await sesionValida(token, SECRET, Date.now())
    expect(resultado).toBeNull()
  })

  it('token alterado → null', async () => {
    const token = await firmarSesion(payload, SECRET)
    // Cambiar el último caracter de la firma
    const alterado = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A')
    const resultado = await sesionValida(alterado, SECRET)
    expect(resultado).toBeNull()
  })

  it('secret distinto → null', async () => {
    const token = await firmarSesion(payload, SECRET)
    const resultado = await sesionValida(token, 'otro-secret-diferente')
    expect(resultado).toBeNull()
  })
})
