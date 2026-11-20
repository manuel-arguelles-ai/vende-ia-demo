// app/api/__tests__/plantilla-export.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
const tenantDeSesion = vi.fn()
const selectMock = vi.fn()
vi.mock('@/lib/core/sesion-helper', () => ({ tenantDeSesion: (...a: unknown[]) => tenantDeSesion(...a) }))
vi.mock('@/lib/core/db', () => ({ supabaseAdmin: () => ({}) }))
vi.mock('@/lib/core/tenant', () => ({ scoped: () => ({ from: () => ({ select: () => ({ order: (...a: unknown[]) => selectMock(...a) }) }) }) }))

import { GET as PLANTILLA } from '../../api/catalogo/plantilla/route'
import { GET as EXPORT } from '../../api/pedidos/export/route'

beforeEach(() => { tenantDeSesion.mockReset(); selectMock.mockReset() })

describe('plantilla', () => {
  it('formato libros → CSV con header de libros', async () => {
    const res = await PLANTILLA(new Request('http://x/api/catalogo/plantilla?formato=libros'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    const txt = await res.text()
    expect(txt).toContain('isbn'); expect(txt).toContain('titulo'); expect(txt).toContain('genero')
  })
  it('formato generico → CSV con header genérico', async () => {
    const txt = await (await PLANTILLA(new Request('http://x/api/catalogo/plantilla?formato=generico'))).text()
    expect(txt).toContain('nombre'); expect(txt).toContain('precio')
  })
})
describe('export pedidos', () => {
  it('sin sesión → 401', async () => {
    tenantDeSesion.mockResolvedValue(null)
    expect((await EXPORT()).status).toBe(401)
  })
  it('con sesión → CSV con pedidos del tenant (flatten de extra)', async () => {
    tenantDeSesion.mockResolvedValue({ tenantId: 6, usuarioId: 1, rol: 'admin' })
    selectMock.mockResolvedValue({ data: [{ created_at: '2026-06-20', producto: 'El Proceso', cantidad: 2, estado: 'nuevo', temperatura: 'caliente', score: 80, remitente: '51999', canal: 'whatsapp', extra: { telefono: '51999', zona: 'Miraflores' } }], error: null })
    const res = await EXPORT()
    expect(res.status).toBe(200)
    const txt = await res.text()
    expect(txt).toContain('El Proceso'); expect(txt).toContain('Miraflores')
  })
})
