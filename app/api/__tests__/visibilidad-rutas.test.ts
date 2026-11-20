import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks (must be hoisted before route imports) ────────────────────────────

const tenantDeSesion = vi.fn()
const remitentesVisibles = vi.fn()

vi.mock('@/lib/core/sesion-helper', () => ({
  tenantDeSesion: (...a: unknown[]) => tenantDeSesion(...a),
}))

vi.mock('@/lib/core/visibilidad', async (orig) => ({
  ...(await orig() as object),
  remitentesVisibles: (...a: unknown[]) => remitentesVisibles(...a),
}))

// ─── Supabase builder mock (chainable: .from().select().order().limit().in()) ─
// The route calls: scoped(db,tid).from('pedidos').select('*').order(...).limit(50)
// Admin path terminates at .limit() (awaited directly).
// Asesor path: .limit(50) returns a builder with .in(), which is awaited.
// We make mockLimit return an object that:
//   (a) has .in() for the asesor path
//   (b) is itself thenable (then/catch) for the admin path

const mockIn = vi.fn()
const mockLimit = vi.fn()
const mockOrder = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

function makeResult() {
  return { data: [], error: null }
}

// Thenable builder object returned by .limit()
function limitBuilder() {
  const obj = {
    in: mockIn,
    then: (resolve: (v: unknown) => void) => resolve(makeResult()),
    catch: () => obj,
    finally: (fn: () => void) => { fn(); return obj },
  }
  return obj
}

mockIn.mockResolvedValue(makeResult())

// Wire the chain
mockFrom.mockReturnValue({ select: mockSelect })
mockSelect.mockReturnValue({ eq: vi.fn(), order: mockOrder })
mockOrder.mockReturnValue({ limit: mockLimit, in: mockIn })
mockLimit.mockImplementation(() => limitBuilder())

vi.mock('@/lib/core/db', () => ({
  supabaseAdmin: vi.fn(() => ({ from: mockFrom })),
}))

// scoped(db, tenantId) wraps the db — return a builder that re-exposes .from()
vi.mock('@/lib/core/tenant', () => ({
  scoped: vi.fn((_db: unknown, _tid: unknown) => ({ from: mockFrom })),
}))

// ─── Route import (after mocks) ───────────────────────────────────────────────

import { GET as PEDIDOS } from '../../api/pedidos/route'

beforeEach(() => {
  vi.clearAllMocks()
  // Re-wire chains after clearAllMocks
  mockFrom.mockReturnValue({ select: mockSelect })
  mockSelect.mockReturnValue({ eq: vi.fn(), order: mockOrder })
  mockOrder.mockReturnValue({ limit: mockLimit, in: mockIn })
  mockLimit.mockImplementation(() => limitBuilder())
  mockIn.mockResolvedValue(makeResult())
  tenantDeSesion.mockReset()
  remitentesVisibles.mockReset()
})

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('pedidos filtra por asesor', () => {
  it('asesor con asignados → query restringida (no 500, status 200)', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 2, tenantId: 6, rol: 'asesor' })
    remitentesVisibles.mockResolvedValue(['51999'])

    const res = await PEDIDOS()

    expect(res.status).toBe(200)
    expect(remitentesVisibles).toHaveBeenCalled()
  })

  it('admin → remitentesVisibles devuelve null (sin filtro)', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 1, tenantId: 6, rol: 'admin' })
    remitentesVisibles.mockResolvedValue(null)

    const res = await PEDIDOS()

    expect(res.status).toBe(200)
  })

  it('asesor sin asignados → respuesta vacía 200', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 3, tenantId: 6, rol: 'asesor' })
    remitentesVisibles.mockResolvedValue([])

    const res = await PEDIDOS()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})
