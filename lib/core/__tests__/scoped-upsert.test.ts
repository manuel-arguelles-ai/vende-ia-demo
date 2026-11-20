import { describe, it, expect } from 'vitest'
import { scoped } from '../tenant'
import type { SupabaseClient } from '@supabase/supabase-js'

function fakeDb(capt: { payload?: unknown; opts?: unknown }) {
  const api: Record<string, unknown> = {
    from() { return api },
    upsert(payload: unknown, opts: unknown) { capt.payload = payload; capt.opts = opts; return Promise.resolve({ error: null }) },
  }
  return api as unknown as SupabaseClient
}

describe('ScopedTable.upsert', () => {
  it('inyecta tenant_id en cada fila y pasa opts', async () => {
    const capt: { payload?: unknown; opts?: unknown } = {}
    await scoped(fakeDb(capt), 7).from('productos').upsert([{ sku: 'A', nombre: 'x' }], { onConflict: 'tenant_id,sku' })
    expect(capt.payload).toEqual([{ sku: 'A', nombre: 'x', tenant_id: 7 }])
    expect(capt.opts).toEqual({ onConflict: 'tenant_id,sku' })
  })
})
