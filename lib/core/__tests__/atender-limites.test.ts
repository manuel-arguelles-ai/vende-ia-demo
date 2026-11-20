import { describe, it, expect, vi } from 'vitest'
import { atender } from '../atender'

function deps(over: Record<string, unknown> = {}) {
  return {
    botPausado: vi.fn(async () => false),
    obtenerNegocio: vi.fn(async () => ({})),
    tenantActivo: vi.fn(async () => true),
    numeroAutorizado: vi.fn(async () => true),
    asignarNuevoLead: vi.fn(async () => null),
    obtenerTenantPlan: vi.fn(async () => ({ plan: 'free', sub_estado: null })),
    estadoLimite: vi.fn(async () => ({ excedido: false, bloquear: false, usados: 0, limite: 1000 })),
    registrarConsumo: vi.fn(async () => {}),
    excedeRate: vi.fn(() => false),
    obtenerResumen: vi.fn(async () => null),
    quizasResumir: vi.fn(async () => {}),
    obtenerVentanaTurnos: vi.fn(async () => 20),
    listarTiendas: vi.fn(async () => []),
    tiendaPorNombre: vi.fn(async () => null),
    registrarCierre: vi.fn(async () => {}),
    cierresPorRemitente: vi.fn(async () => new Map()),
    obtenerPerfil: vi.fn(async () => ({ nombreBot: 'X' })),
    cargarHistorial: vi.fn(async () => [{ rol: 'cliente', texto: 'hola' }]),
    buscarProductos: vi.fn(async () => []),
    extraer: vi.fn(async () => ({ produto: null })),
    ultimoPedido: vi.fn(async () => null),
    conversar: vi.fn(async () => ({ respuesta: 'hola', etapa: 'enganche', temperatura: 'tibio', score: 30, razon: '', derivar: false, handoff: null, etiquetas: [] })),
    guardarMensaje: vi.fn(async () => {}),
    insertPedido: vi.fn(async (r: unknown) => r),
    ...over,
  } as unknown as Parameters<typeof atender>[1]
}

describe('atender — límites', () => {
  it('free excedido (bloquear) → silencia, no llama conversar, no registra', async () => {
    const conversar = vi.fn()
    const registrarConsumo = vi.fn(async () => {})
    const r = await atender({ mensaje: 'hola', canal: 'whatsapp', remitente: 'r1', tenantId: 6 },
      deps({ estadoLimite: vi.fn(async () => ({ excedido: true, bloquear: true, usados: 1000, limite: 1000 })), conversar, registrarConsumo }))
    expect(r.etapa).toBe('limite_excedido')
    expect(conversar).not.toHaveBeenCalled()
    expect(registrarConsumo).not.toHaveBeenCalled()
  })
  it('bajo límite → responde y registra +1 mensaje', async () => {
    const registrarConsumo = vi.fn(async () => {})
    const r = await atender({ mensaje: 'hola', canal: 'whatsapp', remitente: 'r1', tenantId: 6 }, deps({ registrarConsumo }))
    expect(r.respuesta).toBeTruthy()
    expect(registrarConsumo).toHaveBeenCalledWith(6, { mensajes: 1 })
  })
  it('pago excedido (avisa) → responde igual y registra', async () => {
    const conversar = vi.fn(async () => ({ respuesta: 'hola', etapa: 'enganche', temperatura: 'tibio', score: 30, razon: '', derivar: false, handoff: null, etiquetas: [] }))
    const r = await atender({ mensaje: 'hola', canal: 'whatsapp', remitente: 'r1', tenantId: 6 },
      deps({ obtenerTenantPlan: vi.fn(async () => ({ plan: 'pro', sub_estado: 'activa' })), estadoLimite: vi.fn(async () => ({ excedido: true, bloquear: false, usados: 20001, limite: 20000 })), conversar }))
    expect(conversar).toHaveBeenCalled()
    expect(r.respuesta).toBeTruthy()
  })
})
