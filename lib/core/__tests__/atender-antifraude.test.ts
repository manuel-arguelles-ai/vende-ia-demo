import { describe, it, expect, vi } from 'vitest'
import { atender } from '../atender'

function deps(over: Record<string, unknown>) {
  return {
    extraer: vi.fn().mockResolvedValue({ producto: 'x', extra: {}, necesita_aclaracion: false }),
    buscarProductos: vi.fn().mockResolvedValue([{ nombre: 'X', precio: 10, presentacion: null, stock: 5, categoria: null, descripcion: null, marca: null, confianza: 'alta' }]),
    categoriasDelCatalogo: vi.fn().mockResolvedValue([]),
    reformularConsulta: vi.fn().mockResolvedValue({ hayMapeo: false, terminos: [] }),
    conversar: vi.fn().mockResolvedValue({ respuesta: 'Yapéame al 911222333', etapa: 'cierre', score: 70, razon: '', derivar: false, etiquetas: [] }),
    insertPedido: vi.fn().mockResolvedValue({}), cargarHistorial: vi.fn().mockResolvedValue([{ rol: 'cliente', texto: 'hola' }]),
    guardarMensaje: vi.fn().mockResolvedValue(undefined), ultimoPedido: vi.fn().mockResolvedValue(null),
    botPausado: vi.fn().mockResolvedValue(false), agregarEtiqueta: vi.fn(), enriquecerContacto: vi.fn().mockResolvedValue(undefined),
    obtenerNegocio: vi.fn().mockResolvedValue({ yape: '987654321' }), obtenerPerfil: vi.fn().mockResolvedValue({ nombreBot: 'Vera', negocioNombre: 'Demo' }),
    numeroAutorizado: vi.fn().mockResolvedValue(true), tenantActivo: vi.fn().mockResolvedValue(true),
    asignarNuevoLead: vi.fn().mockResolvedValue(undefined), obtenerTenantPlan: vi.fn().mockResolvedValue({ plan: 'pro', sub_estado: null }),
    estadoLimite: vi.fn().mockResolvedValue({ bloquear: false }), registrarConsumo: vi.fn().mockResolvedValue(undefined),
    excedeRate: vi.fn().mockReturnValue(false), registrarAlertaFraude: vi.fn().mockResolvedValue(undefined),
    obtenerResumen: vi.fn().mockResolvedValue(null), quizasResumir: vi.fn().mockResolvedValue(undefined),
    obtenerVentanaTurnos: vi.fn().mockResolvedValue(20),
    listarTiendas: vi.fn().mockResolvedValue([]), tiendaPorNombre: vi.fn().mockResolvedValue(null),
    registrarCierre: vi.fn().mockResolvedValue(undefined), cierresPorRemitente: vi.fn().mockResolvedValue(new Map()),
    ...over,
  } as never
}

describe('atender antifraude bot', () => {
  it('respuesta del bot con pago no configurado → saneada + alerta autor=bot', async () => {
    const registrar = vi.fn().mockResolvedValue(undefined)
    const r = await atender({ mensaje: 'cómo pago?', canal: 'simulador', remitente: 'sim-1', tenantId: 6 }, deps({ registrarAlertaFraude: registrar }))
    expect(r.respuesta).not.toContain('911222333')
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ autor: 'bot' }))
  })
})
