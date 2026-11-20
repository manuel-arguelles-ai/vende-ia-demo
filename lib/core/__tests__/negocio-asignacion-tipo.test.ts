import { describe, it, expect } from 'vitest'
import { obtenerNegocio, guardarNegocio, type DatosNegocio, type ReglaAsignacion } from '../negocio'
import type { SupabaseClient } from '@supabase/supabase-js'

function fakeDb(store: { datos?: DatosNegocio }) {
  const api: Record<string, unknown> = {
    from() { return api },
    select() { return api },
    eq() { return api },
    maybeSingle() { return Promise.resolve({ data: store.datos ? { datos: store.datos } : null, error: null }) },
    upsert(row: { datos: DatosNegocio }) { store.datos = row.datos; return Promise.resolve({ error: null }) },
  }
  return api as unknown as SupabaseClient
}

describe('DatosNegocio.asignacion', () => {
  it('persiste y devuelve la config de asignación', async () => {
    const store: { datos?: DatosNegocio } = {}
    const cfg: DatosNegocio = { asignacion: { regla: 'round_robin' as ReglaAsignacion, limite_default: 15, ultimo_asesor_id: null } }
    await guardarNegocio(cfg, 6, fakeDb(store))
    const got = await obtenerNegocio(6, fakeDb(store))
    expect(got.asignacion?.regla).toBe('round_robin')
    expect(got.asignacion?.limite_default).toBe(15)
  })
})
