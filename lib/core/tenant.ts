import { type SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './db'

// ---------------------------------------------------------------------------
// Tipos internos mínimos para el query builder de supabase-js
// ---------------------------------------------------------------------------
type AnyRecord = Record<string, unknown>

// Un builder encadenable genérico (supabase-js devuelve objetos thenable)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Builder = any

// ---------------------------------------------------------------------------
// ScopedTable — wrapper sobre el builder de supabase-js que:
//   • select / update / delete → encadenan .eq('tenant_id', tenantId)
//   • insert(payload)          → inyecta tenant_id en el/los objeto(s)
//   • el resto de métodos se delegan tal cual al builder subyacente
// ---------------------------------------------------------------------------
class ScopedTable {
  private readonly builder: Builder

  constructor(builder: Builder, private readonly tenantId: number) {
    this.builder = builder
  }

  select(...args: unknown[]): Builder {
    return this.builder.select(...args).eq('tenant_id', this.tenantId)
  }

  update(payload: AnyRecord, ...args: unknown[]): Builder {
    return this.builder.update(payload, ...args).eq('tenant_id', this.tenantId)
  }

  delete(...args: unknown[]): Builder {
    return this.builder.delete(...args).eq('tenant_id', this.tenantId)
  }

  insert(payload: AnyRecord | AnyRecord[]): Builder {
    const withTenant = Array.isArray(payload)
      ? payload.map((row) => ({ ...row, tenant_id: this.tenantId }))
      : { ...payload, tenant_id: this.tenantId }
    return this.builder.insert(withTenant)
  }

  upsert(payload: AnyRecord | AnyRecord[], opts?: { onConflict?: string }): Builder {
    const withTenant = Array.isArray(payload)
      ? payload.map((row) => ({ ...row, tenant_id: this.tenantId }))
      : { ...payload, tenant_id: this.tenantId }
    return this.builder.upsert(withTenant, opts)
  }
}

// ---------------------------------------------------------------------------
// ScopedDb — envuelve db.from() devolviendo un ScopedTable
// ---------------------------------------------------------------------------
class ScopedDb {
  constructor(
    private readonly db: SupabaseClient,
    private readonly tenantId: number,
  ) {}

  from(tabla: string): ScopedTable {
    return new ScopedTable(this.db.from(tabla), this.tenantId)
  }
}

/**
 * Devuelve un proxy ligero sobre `db` que garantiza el filtro de tenant
 * en todas las operaciones de lectura/escritura.
 *
 * Uso:
 *   const s = scoped(db, tenantId)
 *   const { data } = await s.from('pedidos').select('*').eq('remitente', '51999')
 */
export function scoped(db: SupabaseClient, tenantId: number): ScopedDb {
  return new ScopedDb(db, tenantId)
}

// ---------------------------------------------------------------------------
// Resolvers de tenant
// ---------------------------------------------------------------------------

/**
 * Busca el tenant_id asociado a un widget_key en la tabla `canales`.
 * Devuelve `{ tenantId }` o `null` si no existe.
 */
export async function resolverTenantPorWidgetKey(
  widgetKey: string,
  db: SupabaseClient = supabaseAdmin(),
): Promise<{ tenantId: number } | null> {
  const { data, error } = await db
    .from('canales')
    .select('tenant_id')
    .eq('widget_key', widgetKey)
    .single()

  if (error || !data) return null
  return { tenantId: (data as { tenant_id: number }).tenant_id }
}

/**
 * Busca el tenant_id asociado a un slug en la tabla `tenants`.
 * Devuelve `{ tenantId }` o `null` si no existe.
 */
export async function resolverTenantPorSlug(
  slug: string,
  db: SupabaseClient = supabaseAdmin(),
): Promise<{ tenantId: number } | null> {
  const { data, error } = await db
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()

  if (error || !data) return null
  return { tenantId: (data as { id: number }).id }
}
