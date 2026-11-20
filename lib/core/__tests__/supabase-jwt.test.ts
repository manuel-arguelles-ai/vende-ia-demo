// lib/core/__tests__/supabase-jwt.test.ts
import { describe, it, expect } from 'vitest'
import { firmarSupabaseJwt } from '../../supabase-jwt'

// Decodifica un segmento base64url sin padding a string JSON
function b64urlToObj(segment: string): Record<string, unknown> {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice((segment.length + 3) % 4)
  return JSON.parse(atob(padded))
}

// Recomputa HMAC-SHA256 con Web Crypto para verificar la firma del JWT
async function verificarFirmaJwt(jwt: string, secret: string): Promise<boolean> {
  const parts = jwt.split('.')
  if (parts.length !== 3) return false
  const [headerB64, payloadB64, firmaB64] = parts
  const datos = `${headerB64}.${payloadB64}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const firma = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(datos))
  // Convertir ArrayBuffer a base64url para comparar
  let s = ''
  for (const b of new Uint8Array(firma)) s += String.fromCharCode(b)
  const firmaCalculada = btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return firmaCalculada === firmaB64
}

describe('firmarSupabaseJwt', () => {
  const SECRET = 'test-secret-supabase'

  it('produce un JWT con 3 partes separadas por punto', async () => {
    const jwt = await firmarSupabaseJwt(7, 42, SECRET)
    expect(jwt.split('.')).toHaveLength(3)
  })

  it('header tiene alg=HS256 y typ=JWT', async () => {
    const jwt = await firmarSupabaseJwt(7, 42, SECRET)
    const header = b64urlToObj(jwt.split('.')[0])
    expect(header.alg).toBe('HS256')
    expect(header.typ).toBe('JWT')
  })

  it('payload tiene role=authenticated, aud=authenticated, sub=string(usuarioId), tenant_id=string(tenantId)', async () => {
    const jwt = await firmarSupabaseJwt(7, 42, SECRET)
    const payload = b64urlToObj(jwt.split('.')[1])
    expect(payload.role).toBe('authenticated')
    expect(payload.aud).toBe('authenticated')
    expect(payload.sub).toBe('42')
    expect(payload.tenant_id).toBe('7')
  })

  it('exp > iat', async () => {
    const jwt = await firmarSupabaseJwt(7, 42, SECRET)
    const payload = b64urlToObj(jwt.split('.')[1])
    expect(typeof payload.exp).toBe('number')
    expect(typeof payload.iat).toBe('number')
    expect(payload.exp as number).toBeGreaterThan(payload.iat as number)
  })

  it('firma válida con el secret correcto', async () => {
    const jwt = await firmarSupabaseJwt(7, 42, SECRET)
    expect(await verificarFirmaJwt(jwt, SECRET)).toBe(true)
  })

  it('firma inválida con otro secret', async () => {
    const jwt = await firmarSupabaseJwt(7, 42, SECRET)
    expect(await verificarFirmaJwt(jwt, 'otro-secret-diferente')).toBe(false)
  })

  it('ttl por defecto es 3600 segundos', async () => {
    const antes = Math.floor(Date.now() / 1000)
    const jwt = await firmarSupabaseJwt(7, 42, SECRET)
    const payload = b64urlToObj(jwt.split('.')[1])
    const iat = payload.iat as number
    const exp = payload.exp as number
    expect(exp - iat).toBeGreaterThanOrEqual(3598) // margen de 2 seg
    expect(exp - iat).toBeLessThanOrEqual(3602)
    expect(iat).toBeGreaterThanOrEqual(antes)
  })

  it('ttlSegundos customizable', async () => {
    const jwt = await firmarSupabaseJwt(7, 42, SECRET, 7200)
    const payload = b64urlToObj(jwt.split('.')[1])
    const iat = payload.iat as number
    const exp = payload.exp as number
    expect(exp - iat).toBeGreaterThanOrEqual(7198)
    expect(exp - iat).toBeLessThanOrEqual(7202)
  })
})
