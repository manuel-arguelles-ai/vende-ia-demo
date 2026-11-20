import { describe, it, expect, vi } from 'vitest'
import { atender } from '../atender'

const match = { nombre: 'Clean Code', precio: 80, presentacion: null, stock: 3, categoria: 'Ingeniería', descripcion: null, marca: null, confianza: 'alta' as const }

function deps(over: Record<string, unknown>) {
  return {
    extraer: vi.fn().mockResolvedValue({ producto: "libros de O'Reilly", extra: {}, necesita_aclaracion: false }),
    buscarProductos: vi.fn(),
    categoriasDelCatalogo: vi.fn().mockResolvedValue(['Ingeniería', 'Novela']),
    reformularConsulta: vi.fn().mockResolvedValue({ hayMapeo: true, terminos: ['ingeniería'], categoria: 'Ingeniería' }),
    conversar: vi.fn().mockResolvedValue({ respuesta: 'No tenemos O\'Reilly, pero...', etapa: 'enganche', score: 30, razon: '', derivar: false, etiquetas: [] }),
    insertPedido: vi.fn().mockResolvedValue({}), cargarHistorial: vi.fn().mockResolvedValue([{ rol: 'cliente', texto: 'hola' }]),
    guardarMensaje: vi.fn().mockResolvedValue(undefined), ultimoPedido: vi.fn().mockResolvedValue(null),
    botPausado: vi.fn().mockResolvedValue(false), agregarEtiqueta: vi.fn(), enriquecerContacto: vi.fn().mockResolvedValue(undefined),
    obtenerNegocio: vi.fn().mockResolvedValue({}), obtenerPerfil: vi.fn().mockResolvedValue({ nombreBot: 'Vera', negocioNombre: 'Demo' }),
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

describe('atender inferencia', () => {
  it('búsqueda vacía + reformulación con match → conversar recibe alternativaDe + matches', async () => {
    const conversar = vi.fn().mockResolvedValue({ respuesta: 'ok', etapa: 'enganche', score: 30, razon: '', derivar: false, etiquetas: [] })
    const buscar = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([match])
    await atender({ mensaje: "tienen libros de O'Reilly?", canal: 'simulador', remitente: 'sim-1', tenantId: 6 },
      deps({ buscarProductos: buscar, conversar }))
    expect(buscar).toHaveBeenCalledTimes(2)
    const arg = conversar.mock.calls[0][0]
    expect(arg.alternativaDe).toBe("libros de O'Reilly")
    expect(arg.matches).toEqual([match])
  })

  it('búsqueda vacía + sin mapeo → no re-busca, sin alternativaDe', async () => {
    const conversar = vi.fn().mockResolvedValue({ respuesta: 'no tenemos', etapa: 'enganche', score: 10, razon: '', derivar: false, etiquetas: [] })
    const buscar = vi.fn().mockResolvedValue([])
    await atender({ mensaje: 'tienen zapatillas?', canal: 'simulador', remitente: 'sim-2', tenantId: 6 },
      deps({ buscarProductos: buscar, conversar, reformularConsulta: vi.fn().mockResolvedValue({ hayMapeo: false, terminos: [] }) }))
    expect(buscar).toHaveBeenCalledTimes(1)
    expect(conversar.mock.calls[0][0].alternativaDe).toBeUndefined()
  })

  it('match directo → NO entra la segunda pasada', async () => {
    const reformular = vi.fn()
    const buscar = vi.fn().mockResolvedValue([match])
    await atender({ mensaje: 'clean code', canal: 'simulador', remitente: 'sim-3', tenantId: 6 },
      deps({ buscarProductos: buscar, reformularConsulta: reformular }))
    expect(reformular).not.toHaveBeenCalled()
  })

  it('pasa resumenPrevio a conversar y dispara quizasResumir', async () => {
    const conversar = vi.fn().mockResolvedValue({ respuesta: 'ok', etapa: 'x', score: 10, razon: '', derivar: false, etiquetas: [] })
    const quizas = vi.fn().mockResolvedValue(undefined)
    const buscar = vi.fn().mockResolvedValue([match])
    await atender({ mensaje: 'sigo', canal: 'simulador', remitente: 'sim-9', tenantId: 6 },
      deps({ buscarProductos: buscar, conversar, quizasResumir: quizas, obtenerResumen: vi.fn().mockResolvedValue({ resumen: 'Ana, Surco', turnos_resumidos: 25 }) }))
    expect(conversar.mock.calls[0][0].resumenPrevio).toBe('Ana, Surco')
    expect(quizas).toHaveBeenCalled()
  })
})
