import { describe, it, expect, vi, beforeEach } from 'vitest'
const tenantDeSesion = vi.fn()
const obtenerPerfil = vi.fn(async () => ({ nombreBot: 'X' }))
const estadoLimiteMensajes = vi.fn()
const single = vi.fn()
const maybeSingle = vi.fn()
vi.mock('@/lib/core/sesion-helper', () => ({ tenantDeSesion: () => tenantDeSesion() }))
vi.mock('@/lib/core/perfil', () => ({ obtenerPerfil: () => obtenerPerfil() }))
vi.mock('@/lib/core/limites', () => ({ estadoLimiteMensajes: () => estadoLimiteMensajes() }))
vi.mock('@/lib/core/db', () => ({ supabaseAdmin: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: () => single(), maybeSingle: () => maybeSingle() }) }) }) }) }))
import { GET } from '../../api/mi-plan/route'
beforeEach(() => { [tenantDeSesion,estadoLimiteMensajes,single,maybeSingle].forEach(m=>m.mockReset()); obtenerPerfil.mockResolvedValue({ nombreBot:'X' }) })

describe('GET /api/mi-plan consumo', () => {
  it('incluye consumoMes y limiteExcedido', async () => {
    tenantDeSesion.mockResolvedValue({ usuarioId: 1, tenantId: 6, rol: 'admin' })
    single.mockResolvedValue({ data: { nombre:'L', plan:'free', sub_estado:null, sub_proximo_cobro:null, trial_fin:null }, error: null })
    maybeSingle.mockResolvedValue({ data: { email:'a@x.com' }, error: null })
    estadoLimiteMensajes.mockResolvedValue({ excedido:false, bloquear:false, usados:50, limite:1000 })
    const res = await GET()
    const b = await res.json()
    expect(b.consumoMes).toEqual({ mensajes:50, limite:1000 })
    expect(b.limiteExcedido).toBe(false)
  })
})
