import { describe, it, expect } from 'vitest'
import { resumenEnriquecer, enriquecer } from '../enriquecer-catalogo'
import type { SupabaseClient } from '@supabase/supabase-js'

// productos del tenant: 2 sin descripcion/tags, 1 completo
const PRODS = [
  { id: 1, nombre: 'El Proceso', marca: 'Tusquets', descripcion: null, tags: null, atributos: { autor: 'Kafka' } },
  { id: 2, nombre: 'Rayuela', marca: 'Sudamericana', descripcion: 'novela', tags: ['novela'], atributos: { autor: 'Cortázar' } },
  { id: 3, nombre: 'Otro', marca: null, descripcion: null, tags: ['ensayo'], atributos: {} },
]

// fakeDb emulates the underlying builder that ScopedTable wraps (i.e. what db.from(table) returns).
// ScopedTable.select(cols) → builder.select(cols).eq('tenant_id', tenantId) → thenable { data }
// ScopedTable.update(payload) → builder.update(payload).eq('tenant_id', tenantId), then caller chains .eq('id', id)
function fakeDb(updates: Record<number, unknown>) {
  const builder = {
    select(_cols?: unknown) {
      return {
        eq(_col: string, _val: unknown) {
          return Promise.resolve({ data: PRODS, error: null })
        },
      }
    },
    update(payload: unknown) {
      return {
        eq(_tenantCol: string, _tenantVal: unknown) {
          // consume the tenant_id eq; return object for the caller's .eq('id', p.id)
          return {
            eq(_col: string, id: number) {
              updates[id] = payload
              return Promise.resolve({ error: null })
            },
          }
        },
      }
    },
  }
  return {
    from(_table: string) { return builder },
  } as unknown as SupabaseClient
}

describe('resumenEnriquecer', () => {
  it('cuenta los que faltan', async () => {
    const r = await resumenEnriquecer(6, fakeDb({}))
    expect(r.total).toBe(3)
    expect(r.sinDescripcion).toBe(2)  // ids 1 y 3
    expect(r.sinGenero).toBe(1)       // id 1 (sin tags)
  })
})

describe('enriquecer', () => {
  it('completa descripcion/tags vacíos con IA y re-embebe', async () => {
    const updates: Record<number, unknown> = {}
    const chat = async () => ({ descripcion: 'Generada por IA', tags: ['novela', 'clásico'] })
    const embed = async () => [0.1, 0.2]
    const r = await enriquecer(6, fakeDb(updates), chat, embed)
    expect(r.enriquecidos).toBe(2)         // ids 1 y 3 (les falta algo)
    expect(updates[1]).toMatchObject({ descripcion: 'Generada por IA' })
    expect(updates[2]).toBeUndefined()     // ya estaba completo
  })
})
