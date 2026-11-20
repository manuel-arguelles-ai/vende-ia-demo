import { describe, it, expect, vi } from 'vitest'
import {
  normalizarNumero,
  mismoNumero,
  numeroAutorizado,
  listarAutorizados,
  agregarAutorizado,
  quitarAutorizado,
} from '../allowlist'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Mock encadenable que registra llamadas a .eq() — igual al patrón de negocio
// ---------------------------------------------------------------------------
function dbMock(data: unknown = null) {
  const eqCalls: Array<[string, unknown]> = []

  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null })
  const order = vi.fn().mockResolvedValue({ data: data ?? [], error: null })

  const eq = vi.fn().mockImplementation((col: string, val: unknown) => {
    eqCalls.push([col, val])
    return { eq, maybeSingle, order }
  })

  const select = vi.fn().mockReturnValue({ eq, order })
  const deleteFn = vi.fn().mockReturnValue({ eq })
  const upsert = vi.fn().mockResolvedValue({ data: null, error: null })

  const from = vi.fn().mockReturnValue({ select, delete: deleteFn, eq, upsert })

  return {
    db: { from } as unknown as SupabaseClient,
    from,
    select,
    eq,
    eqCalls,
    maybeSingle,
    order,
    upsert,
    deleteFn,
  }
}

// ---------------------------------------------------------------------------
// normalizarNumero
// ---------------------------------------------------------------------------
describe('normalizarNumero', () => {
  it('+51 999-888 → 51999888', () => {
    expect(normalizarNumero('+51 999-888')).toBe('51999888')
  })

  it('web-abc → ""', () => {
    expect(normalizarNumero('web-abc')).toBe('')
  })

  it('solo dígitos pasan tal cual', () => {
    expect(normalizarNumero('51999888777')).toBe('51999888777')
  })
})

// ---------------------------------------------------------------------------
// numeroAutorizado
// ---------------------------------------------------------------------------
// Mock thenable: scoped(db).from().select().eq() resuelve a {data: lista}.
function dbLista(lista: { numero: string }[]) {
  const res = { data: lista, error: null }
  const b: Record<string, unknown> = { select: () => b, eq: () => b, then: (r: (v: typeof res) => void) => r(res) }
  const from = vi.fn(() => b)
  return { db: { from } as unknown as SupabaseClient, from }
}

describe('mismoNumero', () => {
  it('exacto → true', () => expect(mismoNumero('51999888', '51999888')).toBe(true))
  it('tolera prefijo país → true', () => expect(mismoNumero('900000001', '51900000001')).toBe(true))
  it('distintos → false', () => expect(mismoNumero('900000001', '951999888')).toBe(false))
  it('vacío → false', () => expect(mismoNumero('', '51999888')).toBe(false))
})

describe('numeroAutorizado', () => {
  it('autorizado exacto → true', async () => {
    expect(await numeroAutorizado('+51 999-888', 1, dbLista([{ numero: '51999888' }]).db)).toBe(true)
  })
  it('tolera prefijo: lista "900000001", llega "51900000001" → true', async () => {
    expect(await numeroAutorizado('51900000001', 1, dbLista([{ numero: '900000001' }]).db)).toBe(true)
  })
  it('tolera prefijo inverso: lista "51900000001", llega "900000001" → true', async () => {
    expect(await numeroAutorizado('900000001', 1, dbLista([{ numero: '51900000001' }]).db)).toBe(true)
  })
  it('no autorizado → false', async () => {
    expect(await numeroAutorizado('51111222333', 1, dbLista([{ numero: '51999888' }]).db)).toBe(false)
  })
  it('lista vacía → false', async () => {
    expect(await numeroAutorizado('51999888', 1, dbLista([]).db)).toBe(false)
  })
  it('idOrTel null → false sin tocar la DB', async () => {
    const { db, from } = dbLista([])
    expect(await numeroAutorizado(null, 1, db)).toBe(false)
    expect(from).not.toHaveBeenCalled()
  })
  it('"web-xxx" (sin dígitos) → false sin tocar la DB', async () => {
    const { db, from } = dbLista([])
    expect(await numeroAutorizado('web-xxx', 1, db)).toBe(false)
    expect(from).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// listarAutorizados
// ---------------------------------------------------------------------------
describe('listarAutorizados', () => {
  it('devuelve array de registros y filtra por tenant', async () => {
    const filas = [
      { numero: '51999888777', etiqueta: 'Asesor Demo', created_at: '2026-01-02T00:00:00Z' },
      { numero: '51888777666', etiqueta: null, created_at: '2026-01-01T00:00:00Z' },
    ]
    const { db, eqCalls, order } = dbMock(filas)

    // order se llama al final de la cadena y resuelve la promesa
    order.mockResolvedValue({ data: filas, error: null })

    const resultado = await listarAutorizados(1, db)

    expect(resultado).toHaveLength(2)
    expect(resultado[0].numero).toBe('51999888777')
    expect(eqCalls).toContainEqual(['tenant_id', 1])
  })

  it('devuelve [] si no hay datos', async () => {
    const { db, order } = dbMock([])
    order.mockResolvedValue({ data: [], error: null })
    const resultado = await listarAutorizados(1, db)
    expect(resultado).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// agregarAutorizado
// ---------------------------------------------------------------------------
describe('agregarAutorizado', () => {
  it('upsert recibe tenant_id, numero normalizado y etiqueta; onConflict correcto', async () => {
    const { db, upsert } = dbMock()
    await agregarAutorizado('+51 999-888', 'Asesor Demo', 1, db)

    expect(upsert).toHaveBeenCalledWith(
      { tenant_id: 1, numero: '51999888', etiqueta: 'Asesor Demo' },
      { onConflict: 'tenant_id,numero' },
    )
  })

  it('acepta etiqueta null', async () => {
    const { db, upsert } = dbMock()
    await agregarAutorizado('51999888', null, 2, db)

    expect(upsert).toHaveBeenCalledWith(
      { tenant_id: 2, numero: '51999888', etiqueta: null },
      { onConflict: 'tenant_id,numero' },
    )
  })

  it('normaliza el numero antes del upsert', async () => {
    const { db, upsert } = dbMock()
    await agregarAutorizado('+51-999 888 777', 'Test', 1, db)

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ numero: '51999888777' }),
      expect.any(Object),
    )
  })

  it('lanza error si upsert falla', async () => {
    const { db, upsert } = dbMock()
    upsert.mockResolvedValue({ data: null, error: { message: 'DB error' } })

    await expect(agregarAutorizado('51999888', null, 1, db)).rejects.toThrow('DB error')
  })
})

// ---------------------------------------------------------------------------
// quitarAutorizado
// ---------------------------------------------------------------------------
describe('quitarAutorizado', () => {
  it('delete filtra por tenant_id y numero normalizado', async () => {
    const { db, eqCalls } = dbMock()
    await quitarAutorizado('+51 999-888', 1, db)

    expect(eqCalls).toContainEqual(['tenant_id', 1])
    expect(eqCalls).toContainEqual(['numero', '51999888'])
  })

  it('delete filtra por tenant_id=2 correcto', async () => {
    const { db, eqCalls } = dbMock()
    await quitarAutorizado('51999888', 2, db)

    expect(eqCalls).toContainEqual(['tenant_id', 2])
    expect(eqCalls).not.toContainEqual(['tenant_id', 1])
  })
})
