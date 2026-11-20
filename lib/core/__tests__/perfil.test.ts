import { describe, it, expect } from 'vitest'
import { obtenerPerfil, guardarPerfil, type AgentePerfil } from '../perfil'
import { construirSystem, mapPerfil } from '../conversar'
import type { SupabaseClient } from '@supabase/supabase-js'

// Fake mínimo: una tabla en memoria keyed por tenant_id.
function fakeDb(filas: Record<number, Record<string, unknown>>) {
  let filtroTenant: number | null = null
  const api: Record<string, unknown> = {
    from() { return api },
    select() { return api },
    eq(col: string, val: number) { if (col === 'tenant_id') filtroTenant = val; return api },
    maybeSingle() {
      const f = filtroTenant != null ? filas[filtroTenant] : undefined
      return Promise.resolve({ data: f ?? null, error: null })
    },
    upsert(row: Record<string, unknown>) {
      filas[row.tenant_id as number] = { ...(filas[row.tenant_id as number] ?? {}), ...row }
      return Promise.resolve({ error: null })
    },
  }
  return api as unknown as SupabaseClient
}

describe('perfil — capa de datos', () => {
  it('obtenerPerfil mapea columnas nuevas y aplica defaults', async () => {
    const db = fakeDb({ 6: { tenant_id: 6, nombre_bot: 'Vera', negocio_nombre: 'Demo', emojis: false, longitud: 'medias', intensidad_cierre: 'cerrador', agresividad: 'media', tono: 'formal' } })
    const p = await obtenerPerfil(6, db)
    expect(p.nombreBot).toBe('Vera')
    expect(p.negocioNombre).toBe('Demo')
    expect(p.emojis).toBe(false)
    expect(p.longitud).toBe('medias')
    expect(p.intensidadCierre).toBe('cerrador')
    expect(p.agresividad).toBe('media')
    expect(p.tono).toBe('formal')
  })

  it('obtenerPerfil sin fila devuelve defaults seguros (no nulls peligrosos)', async () => {
    const db = fakeDb({})
    const p = await obtenerPerfil(99, db)
    expect(p.emojis).toBe(true)
    expect(p.longitud).toBe('cortas')
    expect(p.intensidadCierre).toBe('cerrador')
    expect(p.agresividad).toBe('suave')
    expect(p.tono).toBe('cercano')
    expect(p.negocioNombre).toBeNull()
  })

  it('guardarPerfil hace upsert tenant-scoped y obtenerPerfil lo devuelve (aislamiento)', async () => {
    const filas: Record<number, Record<string, unknown>> = {}
    const db = fakeDb(filas)
    await guardarPerfil({ nombreBot: 'Sofía', negocioNombre: 'Tienda X', intensidadCierre: 'informativo' }, 7, db)
    expect(filas[7]?.nombre_bot).toBe('Sofía')
    expect(filas[7]?.intensidad_cierre).toBe('informativo')
    const otro = await obtenerPerfil(8, db)   // tenant distinto → no ve la fila de 7
    expect(otro.nombreBot).toBeNull()
  })

  // C1: un tenant sin fila en DB obtiene identidad Asistente/Tienda Genérica (plataforma default)
  it('tenant sin fila obtiene identidad Asistente/Tienda Genérica, nunca Nina (C1 regresión)', async () => {
    const db = fakeDb({})
    const perfilSinFila = await obtenerPerfil(99, db)
    const system = construirSystem(mapPerfil(perfilSinFila))
    expect(system).toContain('Asistente')
    expect(system).toContain('Tienda Genérica')
    expect(system).not.toContain('Nina')
  })

  // C1b: un tenant cuya fila tiene los valores de Nina produce el golden de Nina
  it('tenant con fila Nina → mapPerfil → construirSystem === golden de Nina (C1b)', async () => {
    // Valores de Nina inline para evitar importar el módulo de test (causa error de suite anidada)
    const limaFila = {
      tenant_id: 5,
      nombre_bot: 'Nina',
      negocio_nombre: 'Tienda Demo',
      rubro: 'una tienda online peruana de\nproductos orgánicos y saludables',
      categorias: 'alimentación, bebidas, salud, belleza, hogar, deporte, mascotas',
      tono: 'cercano',
      emojis: true,
      longitud: 'cortas',
      intensidad_cierre: 'cerrador',
      agresividad: 'suave',
    }
    const db = fakeDb({ 5: limaFila })
    const perfil = await obtenerPerfil(5, db)
    const system = construirSystem(mapPerfil(perfil))
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const golden = readFileSync(join(__dirname, 'fixtures', 'nina-prompt.golden.txt'), 'utf8')
    expect(system).toBe(golden)
  })
})
