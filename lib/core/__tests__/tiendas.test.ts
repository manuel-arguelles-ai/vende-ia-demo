import { describe, it, expect, vi } from 'vitest'
import { listarTiendas, tiendaPorNombre } from '../tiendas'

// Mock encadenable + thenable (select/eq/order → self; await → {data})
function dbCon(tiendas: unknown[]) {
  const res = { data: tiendas, error: null }
  const b: Record<string, unknown> = {
    select: () => b, eq: () => b, order: () => b,
    then: (resolve: (v: typeof res) => void) => resolve(res),
  }
  return { from: () => b } as never
}

const TIENDAS = [
  { id: 1, nombre: 'Central', direccion: 'Av. 1', distrito: 'Lima', horario: '9-6', activa: true },
  { id: 2, nombre: 'Miraflores', direccion: 'Av. 2', distrito: 'Miraflores', horario: '10-8', activa: true },
]

describe('listarTiendas', () => {
  it('devuelve las tiendas del tenant', async () => {
    const r = await listarTiendas(6, dbCon(TIENDAS))
    expect(r).toHaveLength(2); expect(r[0].nombre).toBe('Central')
  })
})

describe('tiendaPorNombre', () => {
  it('match exacto case/acentos-tolerante', async () => {
    const t = await tiendaPorNombre(6, '  central ', dbCon(TIENDAS))
    expect(t?.id).toBe(1)
  })
  it('match parcial (el agente dice "tienda de miraflores")', async () => {
    const t = await tiendaPorNombre(6, 'miraflores', dbCon(TIENDAS))
    expect(t?.id).toBe(2)
  })
  it('sin coincidencia → null', async () => {
    const t = await tiendaPorNombre(6, 'surco', dbCon(TIENDAS))
    expect(t).toBeNull()
  })
})
