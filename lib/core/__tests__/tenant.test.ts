import { describe, it, expect, vi } from 'vitest'
import { scoped, resolverTenantPorWidgetKey, resolverTenantPorSlug } from '../tenant'

// ---------------------------------------------------------------------------
// fakeDb — imita el query builder encadenable de supabase-js
// Cada método devuelve `this` para encadenar; la promesa se resuelve al final.
// ---------------------------------------------------------------------------
function makeFakeBuilder(resolvedData: unknown) {
  const builder: Record<string, unknown> = {}

  const methods = ['select', 'update', 'delete', 'insert', 'eq', 'order', 'limit', 'single', 'maybeSingle']

  for (const m of methods) {
    builder[m] = vi.fn().mockReturnValue(builder)
  }

  // Hacer el builder "thenable" (awaitable): resuelve con {data, error}
  ;(builder as Record<string, unknown>).then = (
    resolve: (v: { data: unknown; error: null }) => void,
  ) => resolve({ data: resolvedData, error: null })

  return builder as {
    select: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    then: unknown
  }
}

function makeFakeDb(resolvedData: unknown = null) {
  const builder = makeFakeBuilder(resolvedData)
  const from = vi.fn().mockReturnValue(builder)
  const db = { from } as unknown as Parameters<typeof scoped>[0]
  return { db, from, builder }
}

// ---------------------------------------------------------------------------
// scoped — select
// ---------------------------------------------------------------------------
describe('scoped().from().select()', () => {
  it('encadena .eq("tenant_id", tenantId) después de select', () => {
    const { db, from, builder } = makeFakeDb()
    scoped(db, 7).from('pedidos').select('*')

    expect(from).toHaveBeenCalledWith('pedidos')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.eq).toHaveBeenCalledWith('tenant_id', 7)
  })
})

// ---------------------------------------------------------------------------
// scoped — update
// ---------------------------------------------------------------------------
describe('scoped().from().update()', () => {
  it('encadena .eq("tenant_id", tenantId) después de update', () => {
    const { db, from, builder } = makeFakeDb()
    scoped(db, 7).from('pedidos').update({ estado: 'cerrado' })

    expect(from).toHaveBeenCalledWith('pedidos')
    expect(builder.update).toHaveBeenCalledWith({ estado: 'cerrado' })
    expect(builder.eq).toHaveBeenCalledWith('tenant_id', 7)
  })
})

// ---------------------------------------------------------------------------
// scoped — delete
// ---------------------------------------------------------------------------
describe('scoped().from().delete()', () => {
  it('encadena .eq("tenant_id", tenantId) después de delete', () => {
    const { db, from, builder } = makeFakeDb()
    scoped(db, 7).from('pedidos').delete()

    expect(from).toHaveBeenCalledWith('pedidos')
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('tenant_id', 7)
  })
})

// ---------------------------------------------------------------------------
// scoped — insert (objeto simple)
// ---------------------------------------------------------------------------
describe('scoped().from().insert() — objeto simple', () => {
  it('inyecta tenant_id en el payload antes de llamar al insert real', () => {
    const { db, builder } = makeFakeDb()
    scoped(db, 7).from('pedidos').insert({ a: 1 })

    expect(builder.insert).toHaveBeenCalledWith({ a: 1, tenant_id: 7 })
    // NO encadena eq porque insert ya lleva tenant_id en el payload
  })
})

// ---------------------------------------------------------------------------
// scoped — insert (array de objetos)
// ---------------------------------------------------------------------------
describe('scoped().from().insert() — array de objetos', () => {
  it('inyecta tenant_id en cada elemento del array', () => {
    const { db, builder } = makeFakeDb()
    scoped(db, 7).from('pedidos').insert([{ a: 1 }, { b: 2 }])

    expect(builder.insert).toHaveBeenCalledWith([
      { a: 1, tenant_id: 7 },
      { b: 2, tenant_id: 7 },
    ])
  })
})

// ---------------------------------------------------------------------------
// resolverTenantPorWidgetKey
// ---------------------------------------------------------------------------
describe('resolverTenantPorWidgetKey', () => {
  it('devuelve { tenantId } cuando encuentra la fila', async () => {
    // El builder encadena select → eq → single y resuelve {data: {tenant_id:3}}
    const builder = makeFakeBuilder({ tenant_id: 3 })
    const from = vi.fn().mockReturnValue(builder)
    const db = { from } as unknown as Parameters<typeof resolverTenantPorWidgetKey>[1]

    const result = await resolverTenantPorWidgetKey('widget-key-abc', db)

    expect(from).toHaveBeenCalledWith('canales')
    expect(result).toEqual({ tenantId: 3 })
  })

  it('devuelve null cuando no encuentra la fila', async () => {
    const builder = makeFakeBuilder(null)
    const from = vi.fn().mockReturnValue(builder)
    const db = { from } as unknown as Parameters<typeof resolverTenantPorWidgetKey>[1]

    const result = await resolverTenantPorWidgetKey('no-existe', db)

    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// resolverTenantPorSlug
// ---------------------------------------------------------------------------
describe('resolverTenantPorSlug', () => {
  it('devuelve { tenantId } cuando encuentra la fila (PK es id, no tenant_id)', async () => {
    // La tabla tenants usa PK "id" (no tiene columna tenant_id)
    const builder = makeFakeBuilder({ id: 5 })
    const from = vi.fn().mockReturnValue(builder)
    const db = { from } as unknown as Parameters<typeof resolverTenantPorSlug>[1]

    const result = await resolverTenantPorSlug('tienda-demo', db)

    expect(from).toHaveBeenCalledWith('tenants')
    expect(builder.select).toHaveBeenCalledWith('id')
    expect(result).toEqual({ tenantId: 5 })
  })

  it('devuelve null cuando no encuentra la fila', async () => {
    const builder = makeFakeBuilder(null)
    const from = vi.fn().mockReturnValue(builder)
    const db = { from } as unknown as Parameters<typeof resolverTenantPorSlug>[1]

    const result = await resolverTenantPorSlug('no-existe', db)

    expect(result).toBeNull()
  })
})
