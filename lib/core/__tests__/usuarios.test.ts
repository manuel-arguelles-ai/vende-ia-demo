import { describe, it, expect, vi } from 'vitest'
import { hashPassword } from '../../auth'
import { crearTenantConAdmin, verificarLogin } from '../usuarios'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Helpers para construir un fake db por tabla
// ---------------------------------------------------------------------------

/**
 * Crea un builder encadenable que resuelve con `{ data, error }`.
 * Por defecto resuelve con `{ data: resolvedData, error: null }`.
 */
function makeBuilder(resolvedData: unknown = null, resolvedError: unknown = null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: Record<string, any> = {}

  const methods = ['select', 'update', 'delete', 'insert', 'eq', 'order', 'limit', 'single', 'maybeSingle']
  for (const m of methods) {
    b[m] = vi.fn().mockReturnValue(b)
  }

  // Hacer el builder thenable (awaitable)
  b.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    resolve({ data: resolvedData, error: resolvedError })

  return b
}

/**
 * Crea un fake db cuyo `.from(tabla)` devuelve el builder correspondiente
 * según el mapa `tableMap`. Si la tabla no está en el mapa, devuelve un
 * builder que resuelve con null.
 */
function makeDbByTable(tableMap: Record<string, ReturnType<typeof makeBuilder>>) {
  const from = vi.fn().mockImplementation((tabla: string) => {
    return tableMap[tabla] ?? makeBuilder(null)
  })
  return { db: { from } as unknown as SupabaseClient, from }
}

// ---------------------------------------------------------------------------
// crearTenantConAdmin — caso feliz
// ---------------------------------------------------------------------------
describe('crearTenantConAdmin — caso feliz', () => {
  it('inserta en tenants, usuarios, canales, agente_perfil, negocio y devuelve ids + widgetKey', async () => {
    const tenantBuilder   = makeBuilder({ id: 42 })
    const usuarioBuilder  = makeBuilder({ id: 99 })
    const canalBuilder    = makeBuilder({ widget_key: 'wk-abc123' })
    const agenteBuilder   = makeBuilder(null)   // sin retorno relevante
    const negocioBuilder  = makeBuilder(null)

    const { db, from } = makeDbByTable({
      tenants:      tenantBuilder,
      usuarios:     usuarioBuilder,
      canales:      canalBuilder,
      agente_perfil: agenteBuilder,
      negocio:      negocioBuilder,
    })

    const result = await crearTenantConAdmin(
      { nombre: 'Tienda Demo', rubro: 'retail', email: 'admin@example.com', password: 'clave123' },
      db,
    )

    // Devuelve los ids correctos
    expect(result).toEqual({ tenantId: 42, usuarioId: 99, widgetKey: 'wk-abc123' })

    // Llamó a .from() con cada tabla
    expect(from).toHaveBeenCalledWith('tenants')
    expect(from).toHaveBeenCalledWith('usuarios')
    expect(from).toHaveBeenCalledWith('canales')
    expect(from).toHaveBeenCalledWith('agente_perfil')
    expect(from).toHaveBeenCalledWith('negocio')
  })

  it('el password_hash almacenado es distinto al password en texto plano', async () => {
    let capturedPayload: Record<string, unknown> | null = null

    // Interceptar el insert de usuarios para capturar el payload
    const usuarioBuilder = makeBuilder({ id: 1 })
    const originalInsert = usuarioBuilder.insert
    usuarioBuilder.insert = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
      capturedPayload = payload
      return originalInsert(payload)
    })

    const { db } = makeDbByTable({
      tenants:       makeBuilder({ id: 1 }),
      usuarios:      usuarioBuilder,
      canales:       makeBuilder({ widget_key: 'wk-xyz' }),
      agente_perfil: makeBuilder(null),
      negocio:       makeBuilder(null),
    })

    await crearTenantConAdmin(
      { nombre: 'Tienda Test', rubro: 'test', email: 'test@test.com', password: 'secreto' },
      db,
    )

    expect(capturedPayload).not.toBeNull()
    expect(capturedPayload!.password_hash).toBeDefined()
    expect(capturedPayload!.password_hash).not.toBe('secreto')
    // Debe tener el prefijo del formato scrypt
    expect(typeof capturedPayload!.password_hash).toBe('string')
    expect((capturedPayload!.password_hash as string).startsWith('scrypt$')).toBe(true)
  })

  it('el slug se deriva correctamente: "Tienda Demo" → "tienda-demo"', async () => {
    let capturedSlug: string | null = null

    const tenantBuilder = makeBuilder({ id: 10 })
    const originalInsert = tenantBuilder.insert
    tenantBuilder.insert = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
      capturedSlug = payload.slug as string
      return originalInsert(payload)
    })

    const { db } = makeDbByTable({
      tenants:       tenantBuilder,
      usuarios:      makeBuilder({ id: 1 }),
      canales:       makeBuilder({ widget_key: 'wk-x' }),
      agente_perfil: makeBuilder(null),
      negocio:       makeBuilder(null),
    })

    await crearTenantConAdmin(
      { nombre: 'Tienda Demo', rubro: 'retail', email: 'a@b.com', password: 'p' },
      db,
    )

    expect(capturedSlug).toBe('tienda-demo')
  })

  it('slug de nombre con múltiples palabras y tildes se normaliza bien', async () => {
    let capturedSlug: string | null = null

    const tenantBuilder = makeBuilder({ id: 11 })
    const origInsert = tenantBuilder.insert
    tenantBuilder.insert = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
      capturedSlug = payload.slug as string
      return origInsert(payload)
    })

    const { db } = makeDbByTable({
      tenants:       tenantBuilder,
      usuarios:      makeBuilder({ id: 1 }),
      canales:       makeBuilder({ widget_key: 'wk-y' }),
      agente_perfil: makeBuilder(null),
      negocio:       makeBuilder(null),
    })

    await crearTenantConAdmin(
      { nombre: 'Café & Té Peruano', rubro: 'gastronomía', email: 'b@c.com', password: 'p' },
      db,
    )

    // Tildes normalizadas (é→e, é→e), & eliminado, espacios → guiones
    expect(capturedSlug).toBe('cafe-te-peruano')
  })

  it('agente_perfil se inserta con negocio_nombre igual al nombre del tenant', async () => {
    let capturedAgentePayload: Record<string, unknown> | null = null

    const agenteBuilder = makeBuilder(null)
    const origAgenteInsert = agenteBuilder.insert
    agenteBuilder.insert = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
      capturedAgentePayload = payload
      return origAgenteInsert(payload)
    })

    const { db } = makeDbByTable({
      tenants:       makeBuilder({ id: 55 }),
      usuarios:      makeBuilder({ id: 1 }),
      canales:       makeBuilder({ widget_key: 'wk-test' }),
      agente_perfil: agenteBuilder,
      negocio:       makeBuilder(null),
    })

    await crearTenantConAdmin(
      { nombre: 'Mi Tienda Nueva', rubro: 'retail', email: 'new@test.com', password: 'pass' },
      db,
    )

    expect(capturedAgentePayload).not.toBeNull()
    expect(capturedAgentePayload!.negocio_nombre).toBe('Mi Tienda Nueva')
    expect(capturedAgentePayload!.nombre_bot).toBe('Asistente')
  })
})

// ---------------------------------------------------------------------------
// crearTenantConAdmin — email duplicado
// ---------------------------------------------------------------------------
describe('crearTenantConAdmin — email duplicado', () => {
  it('lanza error con mensaje EMAIL_DUPLICATE cuando el email ya existe', async () => {
    const dupError = { message: 'duplicate key value violates unique constraint (23505)' }
    const usuarioBuilder = makeBuilder(null, dupError)

    const { db } = makeDbByTable({
      tenants:       makeBuilder({ id: 42 }),
      usuarios:      usuarioBuilder,
      canales:       makeBuilder({ widget_key: 'wk-abc' }),
      agente_perfil: makeBuilder(null),
      negocio:       makeBuilder(null),
    })

    await expect(
      crearTenantConAdmin(
        { nombre: 'Tienda X', rubro: 'retail', email: 'dup@test.com', password: 'pass' },
        db,
      ),
    ).rejects.toThrow('EMAIL_DUPLICATE')
  })
})

// ---------------------------------------------------------------------------
// verificarLogin
// ---------------------------------------------------------------------------
describe('verificarLogin', () => {
  it('devuelve { usuarioId, tenantId, rol } con credenciales correctas', async () => {
    const realHash = hashPassword('clave')

    const builder = makeBuilder({
      id: 7,
      tenant_id: 3,
      password_hash: realHash,
      rol: 'admin',
    })
    const from = vi.fn().mockReturnValue(builder)
    const db = { from } as unknown as SupabaseClient

    const result = await verificarLogin('user@test.com', 'clave', db)

    expect(result).toEqual({ usuarioId: 7, tenantId: 3, rol: 'admin' })
  })

  it('devuelve null si la contraseña es incorrecta', async () => {
    const realHash = hashPassword('clave-correcta')

    const builder = makeBuilder({
      id: 7,
      tenant_id: 3,
      password_hash: realHash,
      rol: 'admin',
    })
    const from = vi.fn().mockReturnValue(builder)
    const db = { from } as unknown as SupabaseClient

    const result = await verificarLogin('user@test.com', 'clave-incorrecta', db)

    expect(result).toBeNull()
  })

  it('devuelve null si el email no existe (data=null)', async () => {
    const builder = makeBuilder(null)
    const from = vi.fn().mockReturnValue(builder)
    const db = { from } as unknown as SupabaseClient

    const result = await verificarLogin('noexiste@test.com', 'cualquier', db)

    expect(result).toBeNull()
  })

  it('verifica round-trip real: hashPassword + verificarLogin', async () => {
    const password = 'mi-clave-segura-123'
    const realHash = hashPassword(password)

    const builder = makeBuilder({
      id: 5,
      tenant_id: 2,
      password_hash: realHash,
      rol: 'admin',
    })
    const from = vi.fn().mockReturnValue(builder)
    const db = { from } as unknown as SupabaseClient

    const okResult = await verificarLogin('test@round.com', password, db)
    expect(okResult).not.toBeNull()
    expect(okResult?.usuarioId).toBe(5)

    // Mismo usuario, clave equivocada — necesitamos un nuevo builder porque
    // el anterior ya fue consumido (thenable se resuelve una sola vez)
    const builder2 = makeBuilder({
      id: 5,
      tenant_id: 2,
      password_hash: realHash,
      rol: 'admin',
    })
    const from2 = vi.fn().mockReturnValue(builder2)
    const db2 = { from: from2 } as unknown as SupabaseClient

    const failResult = await verificarLogin('test@round.com', 'wrong', db2)
    expect(failResult).toBeNull()
  })

  // ── Suspensión de tenant ──────────────────────────────────────────────────

  it('clave correcta pero tenant suspendido → null (login bloqueado)', async () => {
    const realHash = hashPassword('clave')

    const usuariosBuilder = makeBuilder({
      id: 7,
      tenant_id: 3,
      password_hash: realHash,
      rol: 'admin',
    })
    const tenantsBuilder = makeBuilder({ estado: 'suspendido' })

    const { db } = makeDbByTable({
      usuarios: usuariosBuilder,
      tenants: tenantsBuilder,
    })

    const result = await verificarLogin('user@test.com', 'clave', db)
    expect(result).toBeNull()
  })

  it('clave correcta y tenant activo → devuelve LoginResult', async () => {
    const realHash = hashPassword('clave')

    const usuariosBuilder = makeBuilder({
      id: 7,
      tenant_id: 3,
      password_hash: realHash,
      rol: 'admin',
    })
    const tenantsBuilder = makeBuilder({ estado: 'activo' })

    const { db } = makeDbByTable({
      usuarios: usuariosBuilder,
      tenants: tenantsBuilder,
    })

    const result = await verificarLogin('user@test.com', 'clave', db)
    expect(result).toEqual({ usuarioId: 7, tenantId: 3, rol: 'admin' })
  })
})
