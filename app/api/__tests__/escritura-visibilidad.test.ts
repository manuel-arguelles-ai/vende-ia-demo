/**
 * Guard de visibilidad en rutas de ESCRITURA por-remitente (sub-proyecto K).
 * Un asesor no puede operar sobre un lead que no tiene asignado → 403.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const tenantDeSesion = vi.fn()
const puedeVerRemitente = vi.fn()
const asesorPuedeEditar = vi.fn()
const registrarCierre = vi.fn()
const setBotPausado = vi.fn()

vi.mock('@/lib/core/sesion-helper', () => ({
  tenantDeSesion: (...a: unknown[]) => tenantDeSesion(...a),
}))
vi.mock('@/lib/core/visibilidad', () => ({
  puedeVerRemitente: (...a: unknown[]) => puedeVerRemitente(...a),
}))
vi.mock('@/lib/core/autorizacion', () => ({
  asesorPuedeEditar: (...a: unknown[]) => asesorPuedeEditar(...a),
}))
vi.mock('@/lib/core/gestion', () => ({
  registrarCierre: (...a: unknown[]) => registrarCierre(...a),
}))
vi.mock('@/lib/core/control', () => ({
  setBotPausado: (...a: unknown[]) => setBotPausado(...a),
}))

import { POST as CIERRES } from '../cierres/route'
import { POST as PAUSAR } from '../pausar/route'

function post(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  tenantDeSesion.mockResolvedValue({ usuarioId: 2, tenantId: 6, rol: 'asesor' })
  asesorPuedeEditar.mockResolvedValue(true) // por defecto, con permiso de edición
})

describe('cierres — guard de visibilidad', () => {
  it('remitente NO asignado → 403, no registra cierre', async () => {
    puedeVerRemitente.mockResolvedValue(false)
    const res = await CIERRES(post('/api/cierres', { remitente: '51999', estado: 'ganado' }))
    expect(res.status).toBe(403)
    expect(registrarCierre).not.toHaveBeenCalled()
  })

  it('remitente asignado → 200 y registra cierre', async () => {
    puedeVerRemitente.mockResolvedValue(true)
    const res = await CIERRES(post('/api/cierres', { remitente: '51999', estado: 'ganado' }))
    expect(res.status).toBe(200)
    expect(registrarCierre).toHaveBeenCalled()
  })

  it('sin sesión → 401', async () => {
    tenantDeSesion.mockResolvedValue(null)
    const res = await CIERRES(post('/api/cierres', { remitente: '51999', estado: 'ganado' }))
    expect(res.status).toBe(401)
  })
})

describe('pausar — guard de visibilidad', () => {
  it('remitente NO asignado → 403, no pausa', async () => {
    puedeVerRemitente.mockResolvedValue(false)
    const res = await PAUSAR(post('/api/pausar', { remitente: '51999', pausado: true }))
    expect(res.status).toBe(403)
    expect(setBotPausado).not.toHaveBeenCalled()
  })

  it('remitente asignado → 200 y pausa', async () => {
    puedeVerRemitente.mockResolvedValue(true)
    const res = await PAUSAR(post('/api/pausar', { remitente: '51999', pausado: true }))
    expect(res.status).toBe(200)
    expect(setBotPausado).toHaveBeenCalled()
  })
})

describe('guard de permiso de edición (N3)', () => {
  it('asesor solo-ver (lead asignado pero sin permiso editar) → 403, no ejecuta', async () => {
    puedeVerRemitente.mockResolvedValue(true)
    asesorPuedeEditar.mockResolvedValue(false) // permiso 'ver' en pipeline
    const res = await CIERRES(post('/api/cierres', { remitente: '51999', estado: 'ganado' }))
    expect(res.status).toBe(403)
    expect(registrarCierre).not.toHaveBeenCalled()
  })

  it('asesor con permiso editar + lead asignado → 200', async () => {
    puedeVerRemitente.mockResolvedValue(true)
    asesorPuedeEditar.mockResolvedValue(true)
    const res = await CIERRES(post('/api/cierres', { remitente: '51999', estado: 'ganado' }))
    expect(res.status).toBe(200)
    expect(registrarCierre).toHaveBeenCalled()
  })
})
