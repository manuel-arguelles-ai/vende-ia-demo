// lib/core/__tests__/asignacion-visibilidad.test.ts
import { describe, it, expect } from 'vitest'
import { asignarLead, remitentesAsignados } from '../asignacion'
import { esAdmin, remitentesVisibles } from '../visibilidad'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * fakeDb — base fake para consultas flat (control_leads, etc.)
 * Soporta maybeSingle() devolviendo null (suficiente para las rutas que no
 * pasan por la validación de usuario, como usuarioId=null).
 */
function fakeDb(leads: Record<string, unknown>[], capt: Record<string, unknown> = {}) {
  let filtroTenant: number | null = null
  let filtroAsignado: number | null = null
  const api: Record<string, unknown> = {
    from() { filtroTenant = null; filtroAsignado = null; return api },
    upsert(row: Record<string, unknown>, opts: unknown) { capt.upsert = row; capt.opts = opts; return Promise.resolve({ error: null }) },
    select() { return api },
    eq(col: string, v: number) { if (col === 'tenant_id') filtroTenant = v; if (col === 'asignado_a') filtroAsignado = v; return api },
    maybeSingle() { return Promise.resolve({ data: null, error: null }) },
    then(res: (v: unknown) => void) {
      const rows = leads.filter((l) => (filtroTenant == null || l.tenant_id === filtroTenant) && (filtroAsignado == null || l.asignado_a === filtroAsignado))
      return Promise.resolve({ data: rows, error: null }).then(res)
    },
  }
  return api as unknown as SupabaseClient
}

/**
 * fakeDbConUsuarios — fake que distingue la tabla 'usuarios' (lookup de tenant)
 * del resto (control_leads para upsert).
 *
 * @param usuariosDelTenant  IDs de usuarios que pertenecen al tenant (lookup → data)
 * @param capt              Captura de upserts para assertions
 */
function fakeDbConUsuarios(usuariosDelTenant: number[], capt: Record<string, unknown> = {}) {
  // Builder para 'usuarios': soporta .select().eq().eq().maybeSingle()
  const usuariosBuilder = (lookupId: number | null) => ({
    select() { return this },
    eq(_col: string, _v: unknown) { return this },
    maybeSingle() {
      const found = lookupId != null && usuariosDelTenant.includes(lookupId)
      return Promise.resolve({ data: found ? { id: lookupId } : null, error: null })
    },
  })

  // Builder para 'control_leads': soporta upsert
  const leadsBuilder = {
    select() { return this },
    eq() { return this },
    maybeSingle() { return Promise.resolve({ data: null, error: null }) },
    upsert(row: Record<string, unknown>, opts: unknown) { capt.upsert = row; capt.opts = opts; return Promise.resolve({ error: null }) },
  }

  // El from() de ScopedDb llama a db.from(tabla) para crear el ScopedTable builder.
  // ScopedTable.select() llama builder.select().eq('tenant_id', tenantId).
  // Luego se encadena .eq('id', usuarioId).maybeSingle() externamente.
  // Necesitamos capturar el usuarioId del eq('id', v) para el lookup.
  const makeUsuariosFromBuilder = () => {
    let capturedId: number | null = null
    return {
      select() { return this },
      eq(_col: string, v: unknown) {
        if (typeof v === 'number') capturedId = v
        return {
          eq(_col2: string, v2: unknown) {
            if (typeof v2 === 'number') capturedId = v2
            return {
              maybeSingle() {
                const found = capturedId != null && usuariosDelTenant.includes(capturedId)
                return Promise.resolve({ data: found ? { id: capturedId } : null, error: null })
              },
            }
          },
          maybeSingle() {
            const found = capturedId != null && usuariosDelTenant.includes(capturedId)
            return Promise.resolve({ data: found ? { id: capturedId } : null, error: null })
          },
        }
      },
    }
  }

  const api = {
    from(tabla: string) {
      if (tabla === 'usuarios') return makeUsuariosFromBuilder()
      return leadsBuilder
    },
  }
  return api as unknown as SupabaseClient
}

describe('asignación', () => {
  it('asignarLead upsert con asignado_a + onConflict remitente,tenant_id', async () => {
    const capt: Record<string, unknown> = {}
    // usuarioId=3 existe en el tenant (incluido en el array)
    await asignarLead('51999', 3, 6, fakeDbConUsuarios([3], capt))
    expect(capt.upsert).toMatchObject({ remitente: '51999', tenant_id: 6, asignado_a: 3 })
    expect(capt.opts).toEqual({ onConflict: 'remitente,tenant_id' })
  })
  it('remitentesAsignados devuelve solo los del asesor', async () => {
    const leads = [{ remitente: '1', tenant_id: 6, asignado_a: 3 }, { remitente: '2', tenant_id: 6, asignado_a: 9 }, { remitente: '3', tenant_id: 6, asignado_a: 3 }]
    expect((await remitentesAsignados(3, 6, fakeDb(leads))).sort()).toEqual(['1', '3'])
  })
})

describe('visibilidad', () => {
  it('esAdmin', () => {
    expect(esAdmin({ usuarioId: 1, tenantId: 6, rol: 'admin' })).toBe(true)
    expect(esAdmin({ usuarioId: 2, tenantId: 6, rol: 'asesor' })).toBe(false)
  })
  it('remitentesVisibles: admin → null (sin filtro)', async () => {
    expect(await remitentesVisibles({ usuarioId: 1, tenantId: 6, rol: 'admin' }, fakeDb([]))).toBeNull()
  })
  it('remitentesVisibles: asesor → solo sus asignados', async () => {
    const leads = [{ remitente: '1', tenant_id: 6, asignado_a: 2 }, { remitente: '2', tenant_id: 6, asignado_a: 9 }]
    expect(await remitentesVisibles({ usuarioId: 2, tenantId: 6, rol: 'asesor' }, fakeDb(leads))).toEqual(['1'])
  })
})

describe('asignarLead — valida tenant del asesor', () => {
  it('usuarioId de otro tenant → lanza/rechaza, no asigna', async () => {
    // usuario 99 NO existe en tenant 6 (array vacío)
    const db = fakeDbConUsuarios([])
    await expect(asignarLead('51999', 99, 6, db)).rejects.toThrow()
  })
  it('usuarioId del tenant → asigna ok', async () => {
    const capt: Record<string, unknown> = {}
    // usuario 3 SÍ existe en tenant 6
    await asignarLead('51999', 3, 6, fakeDbConUsuarios([3], capt))
    expect(capt.upsert).toBeDefined()
  })
  it('desasignar (null) → no valida, asigna null', async () => {
    const capt: Record<string, unknown> = {}
    // null no pasa por validación; fake no tiene usuarios pero debe pasar
    await asignarLead('51999', null, 6, fakeDb([], capt))
    expect(capt.upsert).toBeDefined()
  })
})
