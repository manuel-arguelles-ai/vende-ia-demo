// Token de sesión "payload_b64url.firma" con HMAC-SHA256 (Web Crypto): seguro para el
// middleware (edge runtime). El manejo de passwords vive en lib/auth.ts (Node).
export const COOKIE_SESION = 'vendeia_sesion'
export const SESION_DIAS = 30

export interface SesionPayload {
  usuarioId: number
  tenantId: number
  rol: string
}

function b64url(buf: ArrayBuffer): string {
  let s = ''
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): string {
  const base = s.replace(/-/g, '+').replace(/_/g, '/')
  // Re-agregar el padding '=' correcto: (4 - len%4) % 4 caracteres. El cálculo
  // anterior fallaba para len%4 ∈ {2,3} → atob corrupto → sesión inválida
  // (p.ej. los asesores no podían entrar según la longitud de su token).
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

interface TokenClaims extends SesionPayload {
  exp: number
}

/**
 * Produce un token "claimsB64.firma" que contiene {usuarioId, tenantId, rol, exp}.
 * La expiración está firmada (server-side), no solo en el maxAge de la cookie.
 * El secret se lee de AUTH_SECRET si no se pasa explícitamente.
 * ahoraMs permite inyectar el tiempo actual en tests.
 */
export async function firmarSesion(
  payload: SesionPayload,
  secret?: string,
  ahoraMs: number = Date.now(),
): Promise<string> {
  const secreto = secret ?? process.env.AUTH_SECRET ?? ''
  const claims: TokenClaims = {
    ...payload,
    exp: ahoraMs + SESION_DIAS * 24 * 60 * 60 * 1000,
  }
  const claimsB64 = b64url(new TextEncoder().encode(JSON.stringify(claims)).buffer as ArrayBuffer)
  return `${claimsB64}.${await hmac(claimsB64, secreto)}`
}

/**
 * Valida la firma HMAC, comprueba la expiración firmada y devuelve el payload,
 * o null si el token es inválido, alterado o ha expirado.
 * ahoraMs permite inyectar el tiempo actual en tests.
 */
export async function sesionValida(
  token: string | undefined,
  secret?: string,
  ahoraMs: number = Date.now(),
): Promise<SesionPayload | null> {
  if (!token) return null
  const secreto = secret ?? process.env.AUTH_SECRET ?? ''
  if (!secreto) return null

  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const claimsB64 = token.slice(0, dot)
  const firma = token.slice(dot + 1)

  if ((await hmac(claimsB64, secreto)) !== firma) return null

  try {
    const json = b64urlDecode(claimsB64)
    const parsed = JSON.parse(json) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).usuarioId !== 'number' ||
      typeof (parsed as Record<string, unknown>).tenantId !== 'number' ||
      typeof (parsed as Record<string, unknown>).rol !== 'string' ||
      typeof (parsed as Record<string, unknown>).exp !== 'number'
    ) {
      return null
    }
    const claims = parsed as TokenClaims
    if (claims.exp < ahoraMs) return null
    return { usuarioId: claims.usuarioId, tenantId: claims.tenantId, rol: claims.rol }
  } catch {
    return null
  }
}
