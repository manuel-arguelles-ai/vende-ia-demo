// lib/core/__tests__/atender-asignacion.test.ts
import { describe, it, expect, vi } from 'vitest'
import { atender } from '../atender'

// deps mínimos para que atender llegue al punto de asignación sin tocar red real.
function depsBase(asignarSpy: (...a: unknown[]) => Promise<number | null>) {
  return {
    botPausado: vi.fn(async () => false),
    obtenerNegocio: vi.fn(async () => ({ asignacion: { regla: 'round_robin', limite_default: 5, ultimo_asesor_id: null } })),
    tenantActivo: vi.fn(async () => true),
    numeroAutorizado: vi.fn(async () => true),
    obtenerPerfil: vi.fn(async () => ({ nombreBot: 'X' })),
    cargarHistorial: vi.fn(async () => []),
    buscarProductos: vi.fn(async () => []),
    extraer: vi.fn(async () => ({ producto: null })),
    ultimoPedido: vi.fn(async () => null),
    conversar: vi.fn(async () => ({ respuesta: 'hola', etapa: 'enganche', temperatura: 'tibio', score: 30, razon: '', derivar: false, handoff: null, etiquetas: [] })),
    guardarMensaje: vi.fn(async () => {}),
    insertPedido: vi.fn(async (r: unknown) => r),
    agregarEtiqueta: vi.fn(async () => {}),
    enriquecerContacto: vi.fn(async () => {}),
    asignarNuevoLead: vi.fn(asignarSpy),
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
  } as unknown as Parameters<typeof atender>[1]
}

describe('atender auto-asignación', () => {
  it('invoca asignarNuevoLead para un mensaje entrante', async () => {
    const spy = vi.fn(async () => 1)
    await atender({ mensaje: 'hola amigo', canal: 'whatsapp', remitente: 'r1', tenantId: 6 }, depsBase(spy))
    expect(spy).toHaveBeenCalledWith('r1', 6)
  })
  it('un fallo del motor NO rompe la respuesta', async () => {
    const spy = vi.fn(async () => { throw new Error('motor caído') })
    const r = await atender({ mensaje: 'hola amigo', canal: 'whatsapp', remitente: 'r1', tenantId: 6 }, depsBase(spy))
    expect(r).toBeTruthy()  // atender devolvió respuesta pese al fallo
  })
})
