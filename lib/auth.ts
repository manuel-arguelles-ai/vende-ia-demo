// Verificación de password con scrypt (node:crypto) — solo para la API de login.
// La clave real NUNCA vive en el repo: se guarda como hash en AUTH_PASSWORD_HASH.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

export function verificarPassword(password: string, almacenado: string | undefined): boolean {
  if (!almacenado) return false
  const partes = almacenado.split('$')
  if (partes.length !== 3 || partes[0] !== 'scrypt') return false
  const salt = Buffer.from(partes[1], 'base64url')
  const esperado = Buffer.from(partes[2], 'base64url')
  const hash = scryptSync(password, salt, esperado.length)
  return timingSafeEqual(hash, esperado)
}
