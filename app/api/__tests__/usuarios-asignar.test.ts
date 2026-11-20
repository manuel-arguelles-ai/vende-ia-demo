import { describe, it, expect, vi, beforeEach } from 'vitest'
const tenantDeSesion = vi.fn()
const crearAsesor = vi.fn()
const listarUsuarios = vi.fn()
const actualizarUsuario = vi.fn()
const asignarLead = vi.fn()
const obtenerTenantPlan = vi.fn()
const puedeAgregarAsesor = vi.fn()
vi.mock('@/lib/core/sesion-helper', () => ({ tenantDeSesion: (...a: unknown[]) => tenantDeSesion(...a) }))
vi.mock('@/lib/core/usuarios', () => ({ crearAsesor: (...a: unknown[]) => crearAsesor(...a), listarUsuarios: (...a: unknown[]) => listarUsuarios(...a), actualizarUsuario: (...a: unknown[]) => actualizarUsuario(...a) }))
vi.mock('@/lib/core/asignacion', () => ({ asignarLead: (...a: unknown[]) => asignarLead(...a) }))
vi.mock('@/lib/core/plataforma', () => ({ obtenerTenantPlan: (...a: unknown[]) => obtenerTenantPlan(...a) }))
vi.mock('@/lib/core/limites', () => ({ puedeAgregarAsesor: (...a: unknown[]) => puedeAgregarAsesor(...a) }))

import { GET, POST, PATCH } from '../../api/usuarios/route'
import { POST as ASIGNAR } from '../../api/conversaciones/asignar/route'
const req = (b: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(b) })
beforeEach(() => {
  ;[tenantDeSesion, crearAsesor, listarUsuarios, actualizarUsuario, asignarLead, obtenerTenantPlan, puedeAgregarAsesor].forEach((m) => m.mockReset())
  // Default: plan free, cupo disponible
  obtenerTenantPlan.mockResolvedValue({ plan: 'free', sub_estado: null })
  puedeAgregarAsesor.mockResolvedValue(true)
})

describe('/api/usuarios admin-only', () => {
  it('asesor → 403', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 2, tenantId: 6, rol: 'asesor' })
    expect((await GET()).status).toBe(403)
  })
  it('sin sesión → 401', async () => {
    tenantDeSesion.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
  })
  it('admin GET → listarUsuarios del tenant', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 1, tenantId: 6, rol: 'admin' })
    listarUsuarios.mockResolvedValue([{ id: 1 }])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(listarUsuarios).toHaveBeenCalledWith(6)
  })
  it('admin POST crea asesor con el tenant de sesión', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 1, tenantId: 6, rol: 'admin' })
    crearAsesor.mockResolvedValue({ usuarioId: 9 })
    const res = await POST(req({ nombre: 'Ana', email: 'ana@x.com', password: 'secreto' }))
    expect(res.status).toBe(200)
    expect(crearAsesor).toHaveBeenCalledWith({ nombre: 'Ana', email: 'ana@x.com', password: 'secreto' }, 6)
  })
  it('POST cupo de asesores agotado → 403', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 1, tenantId: 6, rol: 'admin' })
    puedeAgregarAsesor.mockResolvedValue(false)
    const res = await POST(req({ nombre: 'Bob', email: 'bob@x.com', password: 'pass' }))
    expect(res.status).toBe(403)
    expect(crearAsesor).not.toHaveBeenCalled()
  })
  it('POST email duplicado → 409', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 1, tenantId: 6, rol: 'admin' })
    crearAsesor.mockRejectedValue(new Error('EMAIL_DUPLICATE: ya existe'))
    expect((await POST(req({ nombre: 'A', email: 'a@x.com', password: 'x' }))).status).toBe(409)
  })
  it('admin PATCH actualiza', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 1, tenantId: 6, rol: 'admin' })
    const res = await PATCH(req({ id: 9, activo: false }))
    expect(res.status).toBe(200)
    expect(actualizarUsuario).toHaveBeenCalledWith(9, { activo: false }, 6)
  })
  it('PATCH peso=0 → 400 (no entero positivo)', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 1, tenantId: 6, rol: 'admin' })
    expect((await PATCH(req({ id: 9, peso: 0 }))).status).toBe(400)
  })
  it('PATCH peso=-1 → 400', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 1, tenantId: 6, rol: 'admin' })
    expect((await PATCH(req({ id: 9, peso: -1 }))).status).toBe(400)
  })
  it('PATCH peso=1.5 → 400 (no entero)', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 1, tenantId: 6, rol: 'admin' })
    expect((await PATCH(req({ id: 9, peso: 1.5 }))).status).toBe(400)
  })
  it('PATCH peso=3 válido → 200', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 1, tenantId: 6, rol: 'admin' })
    expect((await PATCH(req({ id: 9, peso: 3 }))).status).toBe(200)
  })
  it('PATCH limite_activos=-1 → 400 (negativo)', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 1, tenantId: 6, rol: 'admin' })
    expect((await PATCH(req({ id: 9, limite_activos: -1 }))).status).toBe(400)
  })
  it('PATCH limite_activos=0 válido (no negativo) → 200', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 1, tenantId: 6, rol: 'admin' })
    expect((await PATCH(req({ id: 9, limite_activos: 0 }))).status).toBe(200)
  })
  it('PATCH limite_activos=null válido → 200', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 1, tenantId: 6, rol: 'admin' })
    expect((await PATCH(req({ id: 9, limite_activos: null }))).status).toBe(200)
  })
})

describe('/api/conversaciones/asignar admin-only', () => {
  it('asesor → 403', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 2, tenantId: 6, rol: 'asesor' })
    expect((await ASIGNAR(req({ remitente: '51999', usuarioId: 3 }))).status).toBe(403)
  })
  it('admin asigna con el tenant de sesión', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 1, tenantId: 6, rol: 'admin' })
    const res = await ASIGNAR(req({ remitente: '51999', usuarioId: 3 }))
    expect(res.status).toBe(200)
    expect(asignarLead).toHaveBeenCalledWith('51999', 3, 6)
  })
})
