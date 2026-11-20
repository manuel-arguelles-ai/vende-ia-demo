import { describe, it, expect, vi } from 'vitest'
import { botPausado, setBotPausado, remitentesPausados } from '../control'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock encadenable que rastrea llamadas eq
function dbCon(respuesta: { data: unknown; error: unknown }) {
  const eqCalls: Array<[string, unknown]> = []
  const fin = vi.fn().mockResolvedValue(respuesta)
  // thenable para await directo
  const thenable = { ...respuesta, then: (r: (v: unknown) => void) => r(respuesta) }
  const eq = vi.fn().mockImplementation((col: string, val: unknown) => {
    eqCalls.push([col, val])
    return { eq, maybeSingle: fin, then: (r: (v: unknown) => void) => r(respuesta) }
  })
  const select = vi.fn().mockReturnValue({ eq })
  const upsert = vi.fn().mockResolvedValue(respuesta)
  const from = vi.fn().mockReturnValue({ select, eq, upsert, maybeSingle: fin })
  return { db: { from } as unknown as SupabaseClient, from, select, eq, upsert, eqCalls, fin, thenable }
}

describe('control de takeover', () => {
  it('botPausado devuelve true cuando el lead está pausado', async () => {
    const { db } = dbCon({ data: { bot_pausado: true }, error: null })
    expect(await botPausado('x@lid', 1, db)).toBe(true)
  })

  it('botPausado devuelve false sin fila o con error', async () => {
    expect(await botPausado('x@lid', 1, dbCon({ data: null, error: null }).db)).toBe(false)
    expect(await botPausado('x@lid', 1, dbCon({ data: null, error: { message: 'x' } }).db)).toBe(false)
  })

  it('setBotPausado lanza si el upsert falla', async () => {
    const { db } = dbCon({ data: null, error: { message: 'sin permiso' } })
    await expect(setBotPausado('x@lid', true, 1, db)).rejects.toThrow('sin permiso')
  })

  it('remitentesPausados devuelve el set de pausados', async () => {
    const { db } = dbCon({ data: [{ remitente: 'a@lid' }, { remitente: 'b@lid' }], error: null })
    const s = await remitentesPausados(1, db)
    expect(s.has('a@lid')).toBe(true)
    expect(s.size).toBe(2)
  })
})

describe('control – filtro de tenant', () => {
  it('botPausado filtra por tenant_id', async () => {
    const { db, eqCalls } = dbCon({ data: { bot_pausado: false }, error: null })
    await botPausado('x@lid', 2, db)
    expect(eqCalls).toContainEqual(['tenant_id', 2])
  })

  it('default tenantId=1 aplica tenant 1 en botPausado', async () => {
    const { db, eqCalls } = dbCon({ data: { bot_pausado: false }, error: null })
    await botPausado('x@lid', 1, db)
    expect(eqCalls).toContainEqual(['tenant_id', 1])
  })

  it('setBotPausado upsert incluye tenant_id', async () => {
    const { db, upsert } = dbCon({ data: null, error: null })
    await setBotPausado('x@lid', true, 2, db)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 2 }),
      expect.objectContaining({ onConflict: 'remitente,tenant_id' }),
    )
  })

  it('remitentesPausados filtra por tenant_id', async () => {
    const { db, eqCalls } = dbCon({ data: [], error: null })
    await remitentesPausados(2, db)
    expect(eqCalls).toContainEqual(['tenant_id', 2])
  })
})
