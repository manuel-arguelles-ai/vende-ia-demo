// Sesión del super-admin: token "claimsB64.firma" con HMAC-SHA256 (Web Crypto).
// Separado de lib/sesion.ts (tenant) para evitar escalada de privilegios cruzada.
export const COOKIE_SUPERADMIN = 'vendeia_superadmin'
export const SUPERADMIN_DIAS = 7

export interface SuperadminPayload {
  email: string
}

interface SuperadminClaims extends SuperadminPayload {
  superadmin: true
  exp: number
}

function b64url(buf: ArrayBuffer): string {
  let s = ''
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): string {
  const base = s.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base + '='.repeat((4 - (base.length % 4)) % 4)
  return atob(padded)
}

async function hmac(mensaje: string, secreto: string): Promise<string> {
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
 * Produce un token "claimsB64.firma" con {superadmin:true, email, exp}.
 * ahoraMs permite inyectar el tiempo actual en tests.
 */
export async function firmarSuperadmin(
  payload: SuperadminPayload,
  secret: string,
  ahoraMs: number = Date.now(),
): Promise<string> {
  const claims: SuperadminClaims = {
    superadmin: true,
    email: payload.email,
    exp: ahoraMs + SUPERADMIN_DIAS * 24 * 60 * 60 * 1000,
  }
  const claimsB64 = b64url(new TextEncoder().encode(JSON.stringify(claims)).buffer as ArrayBuffer)
  return `${claimsB64}.${await hmac(claimsB64, secret)}`
}

/**
 * Valida firma HMAC, comprueba expiración y devuelve {superadmin:true, email},
 * o null si el token es inválido, alterado o expirado.
 * ahoraMs permite inyectar el tiempo actual en tests.
 */
export async function superadminValido(
  token: string | undefined,
  secret: string,
  ahoraMs: number = Date.now(),
): Promise<{ superadmin: true; email: string } | null> {
  if (!token) return null
  if (!secret) return null

  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const claimsB64 = token.slice(0, dot)
  const firma = token.slice(dot + 1)

  if ((await hmac(claimsB64, secret)) !== firma) return null

  try {
    const json = b64urlDecode(claimsB64)
    const parsed = JSON.parse(json) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as Record<string, unknown>).superadmin !== true ||
      typeof (parsed as Record<string, unknown>).email !== 'string' ||
      typeof (parsed as Record<string, unknown>).exp !== 'number'
    ) {
      return null
    }
    const claims = parsed as SuperadminClaims
    if (claims.exp < ahoraMs) return null
    return { superadmin: true, email: claims.email }
  } catch {
    return null
  }
}
