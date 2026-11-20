import { describe, it, expect, vi } from 'vitest'
import { periodoActual, estadoLimiteMensajes, puedeAgregarAsesor } from '../limites'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('periodoActual', () => {
  it('formato YYYY-MM', () => {
    expect(periodoActual(new Date('2026-06-21T10:00:00'))).toBe('2026-06')
    expect(periodoActual(new Date('2026-01-05T10:00:00'))).toBe('2026-01')
  })
})

// fakeDb para consumoDelMes (select consumo) + conteo de asesores (usuarios)
function fakeDb({ mensajes = 0, asesores = 0 }: { mensajes?: number; asesores?: number }) {
  let tabla = ''
  const api: Record<string, unknown> = {
    from(t: string) { tabla = t; return api },
    select() { return api },
    eq() { return api },
    maybeSingle() { return Promise.resolve({ data: tabla === 'consumo' ? { mensajes, tokens_llm: 0, segundos_voz: 0 } : null, error: null }) },
    then(res: (v: unknown) => void) {
      const data = tabla === 'usuarios' ? Array.from({ length: asesores }, (_, i) => ({ id: i + 1 })) : []
      return Promise.resolve({ data, error: null }).then(res)
    },
  }
  return api as unknown as SupabaseClient
}

describe('estadoLimiteMensajes', () => {
  it('free bajo límite → no excedido', async () => {
    const e = await estadoLimiteMensajes(6, 'free', null, fakeDb({ mensajes: 500 }))
    expect(e.excedido).toBe(false); expect(e.bloquear).toBe(false); expect(e.limite).toBe(1000)
  })
  it('free excedido → bloquea', async () => {
    const e = await estadoLimiteMensajes(6, 'free', null, fakeDb({ mensajes: 1000 }))
    expect(e.excedido).toBe(true); expect(e.bloquear).toBe(true)
  })
  it('pago (pro) excedido → avisa pero NO bloquea', async () => {
    const e = await estadoLimiteMensajes(6, 'pro', 'activa', fakeDb({ mensajes: 20000 }))
    expect(e.excedido).toBe(true); expect(e.bloquear).toBe(false)
  })
  it('trial excedido → bloquea (como free)', async () => {
    const e = await estadoLimiteMensajes(6, 'pro', 'trial', fakeDb({ mensajes: 20000 }))
    expect(e.bloquear).toBe(true)
  })
  it('enterprise (ilimitado) → nunca excedido', async () => {
    const e = await estadoLimiteMensajes(6, 'enterprise', null, fakeDb({ mensajes: 999999 }))
    expect(e.excedido).toBe(false); expect(e.limite).toBeNull()
  })
})

describe('puedeAgregarAsesor', () => {
  it('free con 1 asesor (límite 1) → false', async () => {
    expect(await puedeAgregarAsesor(6, 'free', fakeDb({ asesores: 1 }))).toBe(false)
  })
  it('pro con 2 asesores (límite 3) → true', async () => {
    expect(await puedeAgregarAsesor(6, 'pro', fakeDb({ asesores: 2 }))).toBe(true)
  })
  it('enterprise (ilimitado) → true siempre', async () => {
    expect(await puedeAgregarAsesor(6, 'enterprise', fakeDb({ asesores: 50 }))).toBe(true)
  })
})
