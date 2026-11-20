// lib/supabase-jwt.ts
// Minta un JWT HS256 compatible con Supabase usando Web Crypto (sin jose/jsonwebtoken).
// El claim tenant_id es leído por las policies RLS: auth.jwt()->>'tenant_id'.
// El primitivo b64url y hmac son idénticos a lib/sesion.ts.

function b64url(buf: ArrayBuffer): string {
  let s = ''
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmacSha256(mensaje: string, secreto: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(mensaje)))
}

/**
 * Genera un JWT HS256 con claims de Supabase:
 *   role:'authenticated', aud:'authenticated', sub:String(usuarioId),
 *   tenant_id:String(tenantId), iat, exp.
 *
 * Supabase RLS lo lee via: auth.jwt()->>'tenant_id'
 * El secret debe ser SUPABASE_JWT_SECRET (el JWT secret del proyecto Supabase).
 */
export async function firmarSupabaseJwt(
  tenantId: number,
  usuarioId: number,
  secret = process.env.SUPABASE_JWT_SECRET!,
  ttlSegundos = 3600,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    role: 'authenticated',
    aud: 'authenticated',
    sub: String(usuarioId),
    tenant_id: String(tenantId),
    iat: now,
    exp: now + ttlSegundos,
  }

  const headerB64 = b64url(new TextEncoder().encode(JSON.stringify(header)).buffer as ArrayBuffer)
  const payloadB64 = b64url(new TextEncoder().encode(JSON.stringify(payload)).buffer as ArrayBuffer)
  const firma = await hmacSha256(`${headerB64}.${payloadB64}`, secret)

  return `${headerB64}.${payloadB64}.${firma}`
}
