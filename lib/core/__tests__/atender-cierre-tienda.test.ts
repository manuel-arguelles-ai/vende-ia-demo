import { describe, it, expect, vi } from 'vitest'
import { atender } from '../atender'

const matchStock = (stock: number) => [{ nombre: 'Clean Code', precio: 80, presentacion: null, stock, categoria: null, descripcion: null, marca: null, confianza: 'alta' as const }]
const TIENDA = { id: 5, nombre: 'Central', direccion: 'Av 1', distrito: 'Lima', horario: '9-6', activa: true }

function deps(over: Record<string, unknown>) {
  return {
    extraer: vi.fn().mockResolvedValue({ producto: 'clean code', cantidad: 2, extra: {}, necesita_aclaracion: false }),
    buscarProductos: vi.fn().mockResolvedValue(matchStock(3)),
    categoriasDelCatalogo: vi.fn().mockResolvedValue([]), reformularConsulta: vi.fn().mockResolvedValue({ hayMapeo: false, terminos: [] }),
    conversar: vi.fn().mockResolvedValue({ respuesta: 'listo', etapa: 'cierre', score: 80, razon: '', derivar: false, etiquetas: [], cierre: { tipo: 'venta', tienda: 'Central' } }),
    insertPedido: vi.fn().mockResolvedValue({}), cargarHistorial: vi.fn().mockResolvedValue([{ rol: 'cliente', texto: 'hola' }]),
    guardarMensaje: vi.fn().mockResolvedValue(undefined), ultimoPedido: vi.fn().mockResolvedValue(null),
    botPausado: vi.fn().mockResolvedValue(false), agregarEtiqueta: vi.fn(), enriquecerContacto: vi.fn().mockResolvedValue(undefined),
    obtenerNegocio: vi.fn().mockResolvedValue({}), obtenerPerfil: vi.fn().mockResolvedValue({ nombreBot: 'Vera' }),
    numeroAutorizado: vi.fn().mockResolvedValue(true), tenantActivo: vi.fn().mockResolvedValue(true),
    asignarNuevoLead: vi.fn().mockResolvedValue(undefined), obtenerTenantPlan: vi.fn().mockResolvedValue({ plan: 'pro', sub_estado: null }),
    estadoLimite: vi.fn().mockResolvedValue({ bloquear: false }), registrarConsumo: vi.fn().mockResolvedValue(undefined),
    excedeRate: vi.fn().mockReturnValue(false), registrarAlertaFraude: vi.fn().mockResolvedValue(undefined),
    obtenerResumen: vi.fn().mockResolvedValue(null), quizasResumir: vi.fn().mockResolvedValue(undefined), obtenerVentanaTurnos: vi.fn().mockResolvedValue(20),
    listarTiendas: vi.fn().mockResolvedValue([TIENDA]), tiendaPorNombre: vi.fn().mockResolvedValue(TIENDA),
    registrarCierre: vi.fn().mockResolvedValue(undefined), cierresPorRemitente: vi.fn().mockResolvedValue(new Map()),
    ...over,
  } as never
}

const input = { mensaje: 'lo quiero, pago yape y recojo en Central', canal: 'simulador' as const, remitente: 'sim-1', tenantId: 6 }

describe('atender — cierre automático venta/reserva', () => {
  it('venta + tienda válida + stock>0 → registra cierre ganado con tipo+tienda', async () => {
    const reg = vi.fn().mockResolvedValue(undefined)
    await atender(input, deps({ registrarCierre: reg }))
    expect(reg).toHaveBeenCalled()
    const [, estado, monto, , , , opts] = reg.mock.calls[0]
    expect(estado).toBe('ganado'); expect(monto).toBe(160); expect(opts).toEqual({ tipo: 'venta', tiendaId: 5 })
  })

  it('reserva → estado reservada', async () => {
    const reg = vi.fn().mockResolvedValue(undefined)
    await atender({ ...input, mensaje: 'resérvamelo y paso a pagar en Central' }, deps({ registrarCierre: reg, conversar: vi.fn().mockResolvedValue({ respuesta: 'te lo aparto', etapa: 'cierre', score: 70, razon: '', derivar: false, etiquetas: [], cierre: { tipo: 'reserva', tienda: 'Central' } }) }))
    expect(reg.mock.calls[0][1]).toBe('reservada')
  })

  it('tienda inexistente → NO registra', async () => {
    const reg = vi.fn().mockResolvedValue(undefined)
    await atender(input, deps({ registrarCierre: reg, tiendaPorNombre: vi.fn().mockResolvedValue(null) }))
    expect(reg).not.toHaveBeenCalled()
  })

  it('stock 0 → NO registra', async () => {
    const reg = vi.fn().mockResolvedValue(undefined)
    await atender(input, deps({ registrarCierre: reg, buscarProductos: vi.fn().mockResolvedValue(matchStock(0)) }))
    expect(reg).not.toHaveBeenCalled()
  })

  it('ya cerrado → no duplica', async () => {
    const reg = vi.fn().mockResolvedValue(undefined)
    const mapa = new Map([['sim-1', { estado: 'ganado', monto: 80 }]])
    await atender(input, deps({ registrarCierre: reg, cierresPorRemitente: vi.fn().mockResolvedValue(mapa) }))
    expect(reg).not.toHaveBeenCalled()
  })

  it('mensaje sin forma+tienda → no registra (aunque el LLM no proponga nada)', async () => {
    const reg = vi.fn().mockResolvedValue(undefined)
    await atender({ ...input, mensaje: 'hola, cuánto cuesta?' }, deps({ registrarCierre: reg, conversar: vi.fn().mockResolvedValue({ respuesta: 'hola', etapa: 'enganche', score: 20, razon: '', derivar: false, etiquetas: [], cierre: null }) }))
    expect(reg).not.toHaveBeenCalled()
  })

  it('detección determinista: cierra aunque el LLM NO emita cierre (mensaje con yape+tienda)', async () => {
    const reg = vi.fn().mockResolvedValue(undefined)
    await atender(input, deps({ registrarCierre: reg, conversar: vi.fn().mockResolvedValue({ respuesta: 'dale', etapa: 'cierre', score: 80, razon: '', derivar: false, etiquetas: [], cierre: null }) }))
    expect(reg).toHaveBeenCalled()
    expect(reg.mock.calls[0][6]).toEqual({ tipo: 'venta', tiendaId: 5 })
  })

  it('modo manual (cierre_auto=false) → NO registra aunque haya señal', async () => {
    const reg = vi.fn().mockResolvedValue(undefined)
    await atender(input, deps({ registrarCierre: reg, obtenerNegocio: vi.fn().mockResolvedValue({ cierre_auto: false }) }))
    expect(reg).not.toHaveBeenCalled()
  })
})
