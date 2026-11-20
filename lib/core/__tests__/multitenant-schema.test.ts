/**
 * Test de esquema multi-tenant contra la DB de staging.
 * Carga variables desde .env.staging via dotenv.
 *
 * Red phase: falla porque las tablas/columnas aún no existen.
 * Green phase: pasa tras aplicar supabase/multitenant.sql.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Cargar .env.staging (relativo al root del proyecto)
config({ path: resolve(process.cwd(), '.env.staging') })

// Test de integración: requiere una DB de staging real. Sin esas credenciales
// (p.ej. en CI) la suite se salta en vez de fallar.
const haveStaging = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const d = haveStaging ? describe : describe.skip

let db: SupabaseClient

beforeAll(() => {
  if (!haveStaging) return
  db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
})

// (a) Las 4 tablas nuevas deben existir
d('tablas nuevas multi-tenant', () => {
  const tablasNuevas = ['tenants', 'usuarios', 'canales', 'agente_perfil']

  for (const tabla of tablasNuevas) {
    it(`tabla "${tabla}" existe`, { timeout: 15000 }, async () => {
      const { error } = await db.from(tabla).select('*').limit(0)
      expect(error, `tabla ${tabla} no existe: ${error?.message}`).toBeNull()
    })
  }
})

// (b) tenant_id debe existir en las 10 tablas existentes
d('columna tenant_id en tablas existentes', () => {
  const tablasConTenantId = [
    'pedidos', 'mensajes', 'productos', 'contactos', 'negocio',
    'control_leads', 'etiquetas_leads', 'cierres', 'notas', 'recordatorios',
  ]

  for (const tabla of tablasConTenantId) {
    it(`"${tabla}" tiene columna tenant_id`, { timeout: 15000 }, async () => {
      const { error } = await db
        .from(tabla)
        .select('tenant_id')
        .limit(0)
      expect(error, `tabla ${tabla} no tiene tenant_id: ${error?.message}`).toBeNull()
    })
  }
})

// (c) Debe existir el tenant con id=1, slug='tienda-demo'
d('tenant Tienda Demo (id=1)', () => {
  it('existe fila en tenants con id=1 y slug="tienda-demo"', { timeout: 15000 }, async () => {
    const { data, error } = await db
      .from('tenants')
      .select('id, slug, nombre')
      .eq('id', 1)
      .single()

    expect(error, `error al buscar tenant 1: ${error?.message}`).toBeNull()
    expect(data).not.toBeNull()
    expect(data?.slug).toBe('tienda-demo')
  })
})

// (d) No deben quedar filas con tenant_id null en productos ni pedidos
d('backfill completo (sin nulls)', () => {
  it('productos: ninguna fila tiene tenant_id null', { timeout: 15000 }, async () => {
    const { data, error } = await db
      .from('productos')
      .select('id')
      .is('tenant_id', null)
      .limit(1)

    expect(error, `error verificando productos: ${error?.message}`).toBeNull()
    expect(data?.length ?? 0).toBe(0)
  })

  it('pedidos: ninguna fila tiene tenant_id null', { timeout: 15000 }, async () => {
    const { data, error } = await db
      .from('pedidos')
      .select('id')
      .is('tenant_id', null)
      .limit(1)

    expect(error, `error verificando pedidos: ${error?.message}`).toBeNull()
    expect(data?.length ?? 0).toBe(0)
  })
})
