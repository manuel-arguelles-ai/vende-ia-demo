import { describe, it, expect, vi } from 'vitest'
import { cierresPorRemitente, registrarCierre, agregarNota, listarNotas, crearRecordatorio, marcarRecordatorio, recordatoriosPendientes } from '../gestion'
import { resumirConversacion } from '../resumir'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock encadenable que soporta scoped(): .from().select().eq().order().limit()
// y .from().insert(), .from().update().eq(), .from().delete().eq()
function dbMock(data: unknown = []) {
  const eqCalls: Array<[string, unknown]> = []
  const insertFn = vi.fn().mockResolvedValue({ error: null })

  // limit es thenable (resolución final)
  const limit = vi.fn().mockResolvedValue({ data, error: null })

  // order es thenable (para .select().order() directo) Y devuelve { limit }
  // para .select().eq().order().limit()
  const orderResult = {
    limit,
    then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data, error: null }).then(onFulfilled, onRejected),
  }
  const order = vi.fn().mockReturnValue(orderResult)

  // eq chain: soporta múltiples .eq() y termina en .order() o .limit() o se resuelve directo
  const eqChain: ReturnType<typeof vi.fn> = vi.fn().mockImplementation((col: string, val: unknown) => {
    eqCalls.push([col, val])
    return {
      eq: eqChain,
      order,
      limit,
      then: (r: (v: unknown) => void) => r({ data, error: null }),
    }
  })

  // update chain: .update({hecho}).eq('tenant_id',N).eq('id',id)
  const updateFn = vi.fn().mockImplementation(() => ({
    eq: eqChain,
  }))

  const select = vi.fn().mockReturnValue({ eq: eqChain, order, limit })
  const deleteFn = vi.fn().mockReturnValue({ eq: eqChain })
  const from = vi.fn().mockReturnValue({ select, insert: insertFn, update: updateFn, delete: deleteFn })
  return { db: { from } as unknown as SupabaseClient, from, select, insertFn, eqCalls }
}

describe('cierresPorRemitente', () => {
  it('la última fila define el estado y reabierto saca el cierre', async () => {
    const { db } = dbMock([
      { remitente: 'a', estado: 'perdido', monto: null, created_at: '1' },
      { remitente: 'a', estado: 'ganado', monto: '105.00', created_at: '2' },
      { remitente: 'b', estado: 'ganado', monto: 50, created_at: '3' },
      { remitente: 'b', estado: 'reabierto', monto: null, created_at: '4' },
    ])
    const m = await cierresPorRemitente(1, db)
    expect(m.get('a')).toMatchObject({ estado: 'ganado', monto: 105 })
    expect(m.has('b')).toBe(false)
  })

  it('filtra por tenant_id', async () => {
    const { db, eqCalls } = dbMock([])
    await cierresPorRemitente(2, db)
    expect(eqCalls).toContainEqual(['tenant_id', 2])
  })
})

describe('registrarCierre', () => {
  it('inserta con tenant_id', async () => {
    const { db, insertFn } = dbMock()
    await registrarCierre('51999', 'ganado', 100, null, 3, db)
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 3 }),
    )
  })
})

describe('agregarNota', () => {
  it('inserta con tenant_id', async () => {
    const { db, insertFn } = dbMock()
    await agregarNota('51999', 'texto', 3, db)
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 3 }),
    )
  })
})

describe('listarNotas', () => {
  it('filtra por tenant_id', async () => {
    const { db, eqCalls } = dbMock([])
    await listarNotas('51999', 2, db)
    expect(eqCalls).toContainEqual(['tenant_id', 2])
  })
})

describe('recordatoriosPendientes', () => {
  it('filtra por tenant_id', async () => {
    const { db, eqCalls } = dbMock([])
    await recordatoriosPendientes(2, db)
    expect(eqCalls).toContainEqual(['tenant_id', 2])
  })
})

describe('resumirConversacion', () => {
  it('pasa la conversación con roles al prompt y devuelve puntos + siguiente paso', async () => {
    const fakeChat = vi.fn().mockResolvedValue({
      puntos: ['Quiere 5 granolas', 'Zona: SMP'],
      siguientePaso: 'Confirmar pago por Yape',
    })
    const r = await resumirConversacion(
      [
        { rol: 'cliente', texto: 'quiero 5 granolas' },
        { rol: 'asesor', texto: 'te paso el yape' },
      ],
      fakeChat,
    )
    expect(r.puntos).toHaveLength(2)
    const user = (fakeChat.mock.calls[0][0] as { user: string }).user
    expect(user).toContain('Cliente: quiero 5 granolas')
    expect(user).toContain('Asesor: te paso el yape')
  })
})
