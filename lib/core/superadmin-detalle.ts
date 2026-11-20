import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './db'
import { scoped } from './tenant'
import { obtenerNegocio, type DatosNegocio } from './negocio'
import { obtenerPerfil, type AgentePerfil } from './perfil'
import { listarTiendas, type Tienda } from './tiendas'
import { listarUsuarios } from './usuarios'
import { obtenerVentanaTurnos } from './plataforma'
import { alertasFraude, type AlertaFraude } from './alertas'
import { tiemposRespuesta, type Tiempos, type MensajeTiempo } from './tiempos'
import { ESCENARIOS_TITULO } from './escenarios-catalogo'
import { etapaLifecycle } from './lifecycle'

export type PedidoReciente = { created_at: string; remitente: string; producto: string | null; cantidad: number | null; temperatura: string; score: number; estado: string }
export type CierreReciente = { created_at: string; remitente: string; estado: string; tipo: string | null; monto: number | null }

// Un chat demo: contacto cuyo nombre lleva prefijo de caso ("E1 · Camila Rojas").
export type TurnoTokens = { msg: string; tokens: number }
export type EscenarioDemo = { caso: string; titulo: string; nombre: string; temperatura: string | null; score: number | null; derivado: boolean; enAtencion: boolean; cierre: string | null; tokens: number | null; turnos: TurnoTokens[] | null }

const RE_CASO = /^([A-Z]{1,3}[0-9]+) · (.+)$/

// Arma el listado de escenarios demo de un inquilino, cruzando contactos
// (prefijados por caso) con el estado de su lead/cierre. Puro y testeable.
export function parsearEscenarios(
  contactos: { remitente: string; nombre: string | null; demo_tokens?: number | null; demo_turnos?: TurnoTokens[] | null }[],
  pedidos: Map<string, { temperatura: string | null; score: number | null; derivar: boolean; estado: string | null }>,
  cierres: Map<string, { estado: string; tipo: string | null }>,
  pausados: Set<string> = new Set(),
): EscenarioDemo[] {
  const lista: EscenarioDemo[] = []
  for (const c of contactos) {
    const m = c.nombre?.match(RE_CASO)
    if (!m) continue
    const ped = pedidos.get(c.remitente)
    const cie = cierres.get(c.remitente)
    lista.push({
      caso: m[1],
      titulo: ESCENARIOS_TITULO[m[1]] ?? '',
      nombre: m[2],
      temperatura: ped?.temperatura ?? null,
      score: ped?.score ?? null,
      derivado: ped?.estado === 'derivado' || (ped?.derivar ?? false),
      enAtencion: pausados.has(c.remitente),
      cierre: cie ? (cie.tipo ? `${cie.estado}/${cie.tipo}` : cie.estado) : null,
      tokens: c.demo_tokens ?? null,
      turnos: c.demo_turnos ?? null,
    })
  }
  // Orden natural por caso: letra y luego número (A1, A2, B1, B2, B10…).
  return lista.sort((a, b) => {
    const [, la = '', na = '0'] = a.caso.match(/^([A-Z]+)(\d+)$/) ?? []
    const [, lb = '', nb = '0'] = b.caso.match(/^([A-Z]+)(\d+)$/) ?? []
    return la === lb ? Number(na) - Number(nb) : la.localeCompare(lb)
  })
}

export type DetalleTenant = {
  negocio: DatosNegocio
  agente: AgentePerfil
  tiendas: Tienda[]
  usuarios: { id: number; nombre: string | null; email: string; rol: string; activo: boolean }[]
  ventanaTurnos: number
  ultimosPedidos: PedidoReciente[]
  ultimosCierres: CierreReciente[]
  alertas: AlertaFraude[]
  tiempos: Tiempos
  escenarios: EscenarioDemo[]
  lifecycle: Record<string, number>
}

// Checklist de avance de configuración del inquilino (para feedback de soporte).
export type ItemConfig = { item: string; ok: boolean }
export function estadoConfiguracion(
  d: Pick<DetalleTenant, 'negocio' | 'agente' | 'tiendas' | 'usuarios'>,
  m: { productos: number; whatsappConectado: boolean },
): { items: ItemConfig[]; pct: number } {
  const items: ItemConfig[] = [
    { item: 'Datos de pago (Yape/Plin/cuenta)', ok: !!(d.negocio.yape || d.negocio.plin || d.negocio.cuenta) },
    { item: 'Horario de atención', ok: !!d.negocio.horario },
    { item: 'Catálogo cargado', ok: m.productos > 0 },
    { item: 'Agente personalizado (rubro)', ok: !!d.agente.rubro },
    { item: 'Tiendas configuradas', ok: d.tiendas.length > 0 },
    { item: 'Asesores agregados', ok: d.usuarios.filter((u) => u.rol === 'asesor').length > 0 },
    { item: 'WhatsApp conectado', ok: m.whatsappConectado },
  ]
  const pct = Math.round((items.filter((i) => i.ok).length / items.length) * 100)
  return { items, pct }
}

// Reúne TODO lo de un inquilino para la ficha de soporte del super-admin.
// Usa service_role (cross-tenant) vía scoped(); las métricas agregadas ya las
// tiene la fila de la tabla, acá van la config + la actividad reciente.
export async function detalleTenant(
  tenantId: number, db: SupabaseClient = supabaseAdmin(),
): Promise<DetalleTenant> {
  const [negocio, agente, tiendas, usuarios, ventanaTurnos, alertas] = await Promise.all([
    obtenerNegocio(tenantId, db),
    obtenerPerfil(tenantId, db),
    listarTiendas(tenantId, db),
    listarUsuarios(tenantId, db),
    obtenerVentanaTurnos(tenantId, db),
    alertasFraude(tenantId, db),
  ])

  const { data: ped } = await scoped(db, tenantId).from('pedidos')
    .select('created_at,remitente,producto,cantidad,temperatura,score,estado')
    .order('created_at', { ascending: false }).limit(10)
  const { data: cie } = await scoped(db, tenantId).from('cierres')
    .select('created_at,remitente,estado,tipo,monto')
    .order('created_at', { ascending: false }).limit(10)

  // Tiempos de respuesta: de los últimos ~2000 mensajes (timestamps ya guardados).
  const { data: msg } = await scoped(db, tenantId).from('mensajes')
    .select('remitente,rol,etapa,created_at')
    .order('created_at', { ascending: false }).limit(2000)
  const tiempos = tiemposRespuesta((msg ?? []) as MensajeTiempo[])

  // Escenarios demo: contactos prefijados por caso cruzados con su lead/cierre.
  const [{ data: cont }, { data: pedTodos }, { data: cieTodos }, { data: pausa }] = await Promise.all([
    scoped(db, tenantId).from('contactos').select('remitente,nombre,demo_tokens,demo_turnos'),
    scoped(db, tenantId).from('pedidos').select('remitente,temperatura,score,derivar,estado,created_at').order('created_at', { ascending: false }).limit(3000),
    scoped(db, tenantId).from('cierres').select('remitente,estado,tipo,created_at').order('created_at', { ascending: false }).limit(3000),
    scoped(db, tenantId).from('control_leads').select('remitente,bot_pausado'),
  ])
  const pedMap = new Map<string, { temperatura: string | null; score: number | null; derivar: boolean; estado: string | null }>()
  for (const p of (pedTodos ?? []) as { remitente: string; temperatura: string | null; score: number | null; derivar: boolean; estado: string | null }[]) {
    if (!pedMap.has(p.remitente)) pedMap.set(p.remitente, p) // primero = más reciente (orden desc)
  }
  const cieMap = new Map<string, { estado: string; tipo: string | null }>()
  for (const c of (cieTodos ?? []) as { remitente: string; estado: string; tipo: string | null }[]) {
    if (!cieMap.has(c.remitente)) cieMap.set(c.remitente, c)
  }
  const pausados = new Set<string>(((pausa ?? []) as { remitente: string; bot_pausado: boolean }[]).filter((x) => x.bot_pausado).map((x) => x.remitente))
  const escenarios = parsearEscenarios((cont ?? []) as { remitente: string; nombre: string | null; demo_tokens?: number | null; demo_turnos?: TurnoTokens[] | null }[], pedMap, cieMap, pausados)

  // B3 — distribución de ciclo de vida sobre los contactos del inquilino.
  const ganados = new Map<string, number>()
  for (const c of (cieTodos ?? []) as { remitente: string; estado: string }[])
    if (c.estado === 'ganado') ganados.set(c.remitente, (ganados.get(c.remitente) ?? 0) + 1)
  const lifecycle: Record<string, number> = {}
  for (const c of (cont ?? []) as { remitente: string }[]) {
    const et = etapaLifecycle({
      score: pedMap.get(c.remitente)?.score ?? null,
      derivado: pedMap.get(c.remitente)?.estado === 'derivado' || (pedMap.get(c.remitente)?.derivar ?? false),
      cierreEstado: (cieMap.get(c.remitente)?.estado as 'ganado' | 'reservada' | 'perdido' | undefined) ?? null,
      comprasGanadas: ganados.get(c.remitente) ?? 0,
    })
    lifecycle[et] = (lifecycle[et] ?? 0) + 1
  }

  return {
    negocio, agente, tiendas, usuarios, ventanaTurnos, alertas, tiempos, escenarios, lifecycle,
    ultimosPedidos: (ped ?? []) as PedidoReciente[],
    ultimosCierres: (cie ?? []) as CierreReciente[],
  }
}
