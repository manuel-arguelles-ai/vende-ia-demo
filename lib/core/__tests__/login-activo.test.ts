import { describe, it, expect } from 'vitest'
import { verificarLogin } from '../usuarios'
import { hashPassword } from '../../auth'
import type { SupabaseClient } from '@supabase/supabase-js'

function fakeDb(usuario: Record<string, unknown> | null, tenantEstado = 'activo') {
  const api: Record<string, unknown> = {
    from(t: string) { api._t = t; return api },
    select() { return api },
    eq() { return api },
    single() { return Promise.resolve({ data: api._t === 'usuarios' ? usuario : { estado: tenantEstado }, error: usuario || api._t !== 'usuarios' ? null : { message: 'no row' } }) },
    maybeSingle() { return Promise.resolve({ data: { estado: tenantEstado }, error: null }) },
  }
  return api as unknown as SupabaseClient
}

describe('verificarLogin — activo', () => {
  const hash = hashPassword('secreto')
  it('usuario activo con pass correcta → sesión', async () => {
    const db = fakeDb({ id: 5, tenant_id: 6, password_hash: hash, rol: 'asesor', activo: true })
    const r = await verificarLogin('a@x.com', 'secreto', db)
    expect(r).toMatchObject({ usuarioId: 5, tenantId: 6, rol: 'asesor' })
  })
  it('usuario inactivo → null aunque la pass sea correcta', async () => {
    const db = fakeDb({ id: 5, tenant_id: 6, password_hash: hash, rol: 'asesor', activo: false })
    expect(await verificarLogin('a@x.com', 'secreto', db)).toBeNull()
  })
})
