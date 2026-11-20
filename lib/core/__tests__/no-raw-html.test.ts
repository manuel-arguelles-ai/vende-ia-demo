import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Único uso permitido: el script de tema en layout.tsx (estático, sin datos de usuario).
const ALLOWLIST = new Set(['app/layout.tsx'])

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      if (e !== 'node_modules' && e !== '.next') walk(p, acc)
    } else if (/\.(tsx|jsx)$/.test(e)) {
      acc.push(p)
    }
  }
  return acc
}

describe('no raw HTML render (anti stored-XSS)', () => {
  it('dangerouslySetInnerHTML solo en el allowlist', () => {
    const root = join(__dirname, '..', '..', '..', 'app')
    const ofensores = walk(root)
      .filter((f) => readFileSync(f, 'utf8').includes('dangerouslySetInnerHTML'))
      .map((f) => f.slice(f.indexOf('app/')))
      .filter((rel) => !ALLOWLIST.has(rel))
    expect(ofensores).toEqual([])
  })
})
