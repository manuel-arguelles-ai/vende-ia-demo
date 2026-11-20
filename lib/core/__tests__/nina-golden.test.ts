// lib/core/__tests__/nina-golden.test.ts
import { describe, it, expect } from 'vitest'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { construirSystem } from '../conversar'

const dir = join(__dirname, 'fixtures')
const path = join(dir, 'nina-prompt.golden.txt')

// NINA_SEED: valores con los que se siembra la fila de Nina en prod (Task 6).
// Tras el refactor (Task 3), construirSystem(NINA_SEED) debe igualar este golden.
export const NINA_SEED = {
  nombreBot: 'Nina',
  negocioNombre: 'Tienda Demo',
  rubro: 'una tienda online peruana de\nproductos orgánicos y saludables',
  categorias: 'alimentación, bebidas, salud, belleza, hogar, deporte, mascotas',
  tono: 'cercano' as const,
  emojis: true,
  longitud: 'cortas' as const,
  intensidadCierre: 'cerrador' as const,
  agresividad: 'suave' as const,
}

// Auto-siembra en la primera corrida con los valores reales de Nina.
if (!existsSync(path)) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(path, construirSystem(NINA_SEED), 'utf8')
}
const golden = readFileSync(path, 'utf8')

describe('Nina golden prompt (regresión)', () => {
  it('construirSystem(NINA_SEED) (fila sembrada de Nina) reproduce el prompt byte a byte', () => {
    expect(construirSystem(NINA_SEED)).toBe(golden)
  })

  it('construirSystem({}) (sin perfil) usa identidad Asistente/Tienda Genérica, nunca Nina', () => {
    const prompt = construirSystem({})
    expect(prompt).toContain('Asistente')
    expect(prompt).toContain('Tienda Genérica')
    expect(prompt).not.toContain('Nina')
  })
})
