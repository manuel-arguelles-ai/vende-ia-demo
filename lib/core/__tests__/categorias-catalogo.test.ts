import { describe, it, expect } from 'vitest'
import { categoriasDelCatalogo } from '../catalogo'

describe('categoriasDelCatalogo', () => {
  it('dedup de seccion/categoria/tags, cap', async () => {
    const data = [
      { seccion: 'Ingeniería', categoria: 'Programación', tags: ['software', 'java'] },
      { seccion: 'Ingeniería', categoria: 'Redes', tags: ['software'] },
    ]
    const db = { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data, error: null }) }) }) } as never
    const cats = await categoriasDelCatalogo(6, db)
    expect(cats).toContain('Ingeniería'); expect(cats).toContain('Programación')
    expect(cats).toContain('software'); expect(new Set(cats).size).toBe(cats.length)
  })
})
