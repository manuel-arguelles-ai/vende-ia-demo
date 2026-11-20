import { describe, it, expect, vi, beforeEach } from 'vitest'

const obtenerPerfil = vi.fn()
const guardarPerfil = vi.fn()
const tenantDeSesion = vi.fn()
vi.mock('@/lib/core/perfil', () => ({ obtenerPerfil: (...a: unknown[]) => obtenerPerfil(...a), guardarPerfil: (...a: unknown[]) => guardarPerfil(...a) }))
vi.mock('@/lib/core/sesion-helper', () => ({ tenantDeSesion: (...a: unknown[]) => tenantDeSesion(...a) }))

import { GET, PUT } from '../../api/agente/route'

beforeEach(() => { obtenerPerfil.mockReset(); guardarPerfil.mockReset(); tenantDeSesion.mockReset() })

describe('GET/PUT /api/agente', () => {
  it('GET sin sesión → 401', async () => {
    tenantDeSesion.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })
  it('GET con sesión → perfil del tenant', async () => {
    tenantDeSesion.mockResolvedValue({ tenantId: 6 })
    obtenerPerfil.mockResolvedValue({ nombreBot: 'Vera' })
    const res = await GET()
    expect(res.status).toBe(200)
    expect(obtenerPerfil).toHaveBeenCalledWith(6)
    expect(await res.json()).toMatchObject({ nombreBot: 'Vera' })
  })
  it('PUT con enum inválido → 400', async () => {
    tenantDeSesion.mockResolvedValue({ tenantId: 6 })
    const req = new Request('http://x/api/agente', { method: 'PUT', body: JSON.stringify({ tono: 'gritón' }) })
    const res = await PUT(req)
    expect(res.status).toBe(400)
    expect(guardarPerfil).not.toHaveBeenCalled()
  })
  it('PUT válido → guarda con el tenant de sesión', async () => {
    tenantDeSesion.mockResolvedValue({ tenantId: 6 })
    const req = new Request('http://x/api/agente', { method: 'PUT', body: JSON.stringify({ nombreBot: 'Vera', tono: 'formal', emojis: false }) })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    expect(guardarPerfil).toHaveBeenCalledWith(expect.objectContaining({ nombreBot: 'Vera', tono: 'formal', emojis: false }), 6)
  })
})
