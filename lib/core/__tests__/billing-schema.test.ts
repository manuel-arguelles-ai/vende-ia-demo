/**
 * Test de esquema billing contra la DB de staging.
 * Carga variables desde .env.staging via dotenv.
 *
 * Red phase: falla porque las columnas/tablas billing aún no existen.
 * Green phase: pasa tras aplicar supabase/billing.sql.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.staging') })

// Test de integración: requiere DB de staging real. Sin credenciales (CI) se salta.
const haveStaging = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const d = haveStaging ? describe : describe.skip

let db: SupabaseClient

beforeAll(() => {
  if (!haveStaging) return
  db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
})

// (a) Columnas billing en tenants
d('columnas billing en tenants', () => {
  it('tenants tiene mp_preapproval_id', { timeout: 15000 }, async () => {
    const { error } = await db.from('tenants').select('mp_preapproval_id').limit(0)
    expect(error, `mp_preapproval_id no existe: ${error?.message}`).toBeNull()
  })

  it('tenants tiene sub_estado', { timeout: 15000 }, async () => {
    const { error } = await db.from('tenants').select('sub_estado').limit(0)
    expect(error, `sub_estado no existe: ${error?.message}`).toBeNull()
  })

  it('tenants tiene trial_fin', { timeout: 15000 }, async () => {
    const { error } = await db.from('tenants').select('trial_fin').limit(0)
    expect(error, `trial_fin no existe: ${error?.message}`).toBeNull()
  })

  it('tenants tiene sub_proximo_cobro', { timeout: 15000 }, async () => {
    const { error } = await db.from('tenants').select('sub_proximo_cobro').limit(0)
    expect(error, `sub_proximo_cobro no existe: ${error?.message}`).toBeNull()
  })

  it('tenants tiene sub_actualizado', { timeout: 15000 }, async () => {
    const { error } = await db.from('tenants').select('sub_actualizado').limit(0)
    expect(error, `sub_actualizado no existe: ${error?.message}`).toBeNull()
  })
})

// (b) Tabla facturacion_eventos existe con columnas esperadas
d('tabla facturacion_eventos', () => {
  it('existe y tiene columnas id, tenant_id, mp_event_id, tipo, payload, created_at', { timeout: 15000 }, async () => {
    const { error } = await db
      .from('facturacion_eventos')
      .select('id,tenant_id,mp_event_id,tipo,payload,created_at')
      .limit(0)
    expect(error, `facturacion_eventos error: ${error?.message}`).toBeNull()
  })

  it('RLS habilitado: anon no puede leer facturacion_eventos', { timeout: 15000 }, async () => {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const url = process.env.SUPABASE_URL
    if (!anonKey || !url) throw new Error('Faltan creds anon')
    const anonDb = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data, error } = await anonDb.from('facturacion_eventos').select('id').limit(1)
    // Con RLS sin policy para anon → data vacío o error de permisos
    const bloqueado = (data !== null && data.length === 0) || error !== null
    expect(bloqueado, `anon pudo leer facturacion_eventos: data=${JSON.stringify(data)}, error=${error?.message}`).toBe(true)
  })

  it('service_role puede insertar y leer en facturacion_eventos', { timeout: 15000 }, async () => {
    // Insertar un evento de prueba
    const testEventId = `test-${Date.now()}`
    const { error: insertError } = await db.from('facturacion_eventos').insert({
      tenant_id: 1,
      mp_event_id: testEventId,
      tipo: 'test',
      payload: { test: true },
    })
    expect(insertError, `error insertando: ${insertError?.message}`).toBeNull()

    // Leer el evento insertado
    const { data, error: selectError } = await db
      .from('facturacion_eventos')
      .select('mp_event_id,tipo')
      .eq('mp_event_id', testEventId)
      .single()
    expect(selectError, `error leyendo: ${selectError?.message}`).toBeNull()
    expect(data?.mp_event_id).toBe(testEventId)
    expect(data?.tipo).toBe('test')

    // Limpiar
    await db.from('facturacion_eventos').delete().eq('mp_event_id', testEventId)
  })
})

// (c) Tabla billing_config existe
d('tabla billing_config', () => {
  it('existe con columnas plan, mp_preapproval_plan_id', { timeout: 15000 }, async () => {
    const { error } = await db
      .from('billing_config')
      .select('plan,mp_preapproval_plan_id')
      .limit(0)
    expect(error, `billing_config error: ${error?.message}`).toBeNull()
  })
})
