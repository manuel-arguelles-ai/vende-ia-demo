import { extraer as extraerReal } from './extraer'
import { buscarProductos as buscarReal, categoriasDelCatalogo as categoriasReal, type ProductoMatch } from './catalogo'
import { reformularConsulta as reformularReal } from './reformular'
import { conversar as conversarReal, modoVenta } from './conversar'
import { obtenerNegocio as obtenerNegocioReal } from './negocio'
import { insertPedido as insertReal, ultimoPedido as ultimoReal } from './db'
import { cargarHistorial as cargarReal, guardarMensaje as guardarReal } from './historial'
import { botPausado as pausadoReal } from './control'
import { agregarEtiqueta as etiquetarReal } from './etiquetas'
import { enriquecerContacto as enriquecerReal, obtenerContacto as obtenerContactoReal, marcarOptoutMarketing as marcarOptoutReal } from './contactos'
import { requiereEscalada, resumenEscalada } from './escalada'
import { esOptOut } from './seguimientos'
import { obtenerPerfil as obtenerPerfilReal } from './perfil'
import { recortar, inyeccionDetectada, respuestaSegura } from './guardrails'
import { numeroAutorizado as numeroAutorizadoReal } from './allowlist'
import { tenantActivo as tenantActivoReal, obtenerTenantPlan as obtenerTenantPlanReal, obtenerVentanaTurnos as obtenerVentanaReal } from './plataforma'
import { asignarNuevoLead as asignarNuevoRealReal } from './motor-asignacion'
import { estadoLimiteMensajes as estadoLimiteRealReal, registrarConsumo as registrarConsumoReal } from './limites'
import { excedeRate as excedeRateReal } from './ratelimit'
import { detectarPagoNoAutorizado } from './antifraude-pago'
import { verificarPago, pagosPrevios } from './pago'
import { registrarAlertaFraude as registrarAlertaReal } from './alertas'
import { obtenerResumen as obtenerResumenReal, quizasResumir as quizasResumirReal } from './memoria'
import { listarTiendas as listarTiendasReal, tiendaPorNombre as tiendaPorNombreReal } from './tiendas'
import { registrarCierre as registrarCierreReal, cierresPorRemitente as cierresPorRemitenteReal } from './gestion'
import { detectarCierreAuto } from './cierre-auto'
import type { PedidoGuardado } from './schemas'

export type AtenderInput = {
  mensaje: string
  canal: 'whatsapp' | 'simulador' | 'web'
  remitente: string
  telefono?: string | null // jid/número real del cliente (el remitente puede ser un LID opaco)
  tenantId?: number
  // Comprobante de pago leído por visión (Yape/Plin): el código verifica el monto vs el total.
  comprobante?: { monto: number | null; titular?: string | null; operacion?: string | null }
}

export type AtenderResultado = {
  respuesta: string
  etapa: string
  derivar: boolean
  handoff: string | null
  saved: PedidoGuardado | null
  // true = la conversación está en takeover humano: el mensaje del cliente se
  // registró pero Nina NO responde (el canal no debe enviar nada).
  silenciado?: boolean
}

type Deps = {
  extraer: typeof extraerReal
  buscarProductos: typeof buscarReal
  categoriasDelCatalogo: typeof categoriasReal
  reformularConsulta: typeof reformularReal
  conversar: typeof conversarReal
  insertPedido: typeof insertReal
  cargarHistorial: typeof cargarReal
  guardarMensaje: typeof guardarReal
  ultimoPedido: typeof ultimoReal
  botPausado: typeof pausadoReal
  agregarEtiqueta: typeof etiquetarReal
  enriquecerContacto: typeof enriquecerReal
  obtenerNegocio: typeof obtenerNegocioReal
  obtenerPerfil: typeof obtenerPerfilReal
  numeroAutorizado: typeof numeroAutorizadoReal
  tenantActivo: typeof tenantActivoReal
  asignarNuevoLead: typeof asignarNuevoRealReal
  obtenerTenantPlan: (tenantId: number) => Promise<{ plan: string; sub_estado: string | null }>
  estadoLimite: typeof estadoLimiteRealReal
  registrarConsumo: typeof registrarConsumoReal
  excedeRate: typeof excedeRateReal
  registrarAlertaFraude: typeof registrarAlertaReal
  obtenerResumen: typeof obtenerResumenReal
  quizasResumir: typeof quizasResumirReal
  obtenerVentanaTurnos: typeof obtenerVentanaReal
  listarTiendas: typeof listarTiendasReal
  tiendaPorNombre: typeof tiendaPorNombreReal
  registrarCierre: typeof registrarCierreReal
  cierresPorRemitente: typeof cierresPorRemitenteReal
  obtenerContacto?: typeof obtenerContactoReal
  marcarOptout?: typeof marcarOptoutReal
}

const defaults: Deps = {
  extraer: extraerReal,
  buscarProductos: buscarReal,
  categoriasDelCatalogo: categoriasReal,
  reformularConsulta: reformularReal,
  conversar: conversarReal,
  insertPedido: insertReal,
  cargarHistorial: cargarReal,
  guardarMensaje: guardarReal,
  ultimoPedido: ultimoReal,
  botPausado: pausadoReal,
  agregarEtiqueta: etiquetarReal,
  enriquecerContacto: enriquecerReal,
  obtenerNegocio: obtenerNegocioReal,
  obtenerPerfil: obtenerPerfilReal,
  numeroAutorizado: numeroAutorizadoReal,
  tenantActivo: tenantActivoReal,
  asignarNuevoLead: asignarNuevoRealReal,
  obtenerTenantPlan: obtenerTenantPlanReal,
  estadoLimite: estadoLimiteRealReal,
  registrarConsumo: registrarConsumoReal,
  excedeRate: excedeRateReal,
  registrarAlertaFraude: registrarAlertaReal,
  obtenerResumen: obtenerResumenReal,
  quizasResumir: quizasResumirReal,
  obtenerVentanaTurnos: obtenerVentanaReal,
  listarTiendas: listarTiendasReal,
  tiendaPorNombre: tiendaPorNombreReal,
  registrarCierre: registrarCierreReal,
  cierresPorRemitente: cierresPorRemitenteReal,
  obtenerContacto: obtenerContactoReal,
  marcarOptout: marcarOptoutReal,
}

// Saludo genérico de primer contacto → bienvenida fija sin LLM (cero tokens, cero folleto doble).
const SALUDO_RE = /^(hola+|holi+|buenas+|buen[oa]s?\s+(d[ií]as|tardes|noches)|hello|hi|ola)[\s!.,…~🌱😊👋🙌]*$/iu

// Genera el mensaje de bienvenida a partir del perfil del tenant.
// Si el perfil incluye un saludoInicial configurado, se usa ese.
// Si no, se construye desde nombreBot / negocioNombre con un fallback neutro.
export function bienvenidaDe(
  nombreBot?: string | null,
  negocioNombre?: string | null,
  saludoInicial?: string | null,
): string {
  if (saludoInicial) return saludoInicial
  const bot = nombreBot ?? null
  const negocio = negocioNombre ?? null
  if (bot && negocio) {
    return `¡Hola! Soy ${bot}, de ${negocio} 🌱 ¿En qué te puedo ayudar?`
  }
  if (bot) return `¡Hola! Soy ${bot} 🌱 ¿En qué te puedo ayudar?`
  return '¡Hola! ¿En qué te puedo ayudar?'
}

// El modelo a veces formatea con markdown; WhatsApp usa *negrita* y texto plano.
export function sanitizarRespuesta(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/^#{1,4}\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Capa 3 de grounding: detecta precios en la respuesta que no salen del catálogo inyectado.
// Legítimos: el precio exacto de un match, precios embebidos en su presentacion o descripcion
// (tamaños/packs alternativos, ej. "Six pack a S/108.00"), o un múltiplo entero (≤12) del
// precio de un match [exacto] (recap "2 × S/27.50 = S/55.00").
const RE_PRECIO = /S\/\s*(\d+(?:[.,]\d{1,2})?)/g

export function precioFantasma(respuesta: string, matches: ProductoMatch[]): boolean {
  const citados = [...respuesta.matchAll(RE_PRECIO)].map((m) => Number(m[1].replace(',', '.')))
  if (!citados.length) return false
  if (!matches.length) return true
  const exactos: number[] = []
  const bases: number[] = []
  for (const m of matches) {
    exactos.push(Number(m.precio))
    if (m.confianza === 'alta') bases.push(Number(m.precio))
    for (const p of `${m.presentacion ?? ''} ${m.descripcion ?? ''}`.matchAll(RE_PRECIO))
      exactos.push(Number(p[1].replace(',', '.')))
  }
  return citados.some((c) => {
    if (exactos.some((p) => Math.abs(c - p) < 0.01)) return false
    return !bases.some((p) => {
      const n = c / p
      return n > 1 && n <= 12 && Math.abs(n - Math.round(n)) < 0.001
    })
  })
}

// La temperatura sale del score por bandas fijas (el LLM a veces las contradice).
export function temperaturaDe(score: number): 'caliente' | 'tibio' | 'frio' {
  return score >= 61 ? 'caliente' : score >= 26 ? 'tibio' : 'frio'
}

// Orquesta un turno de conversación: memoria → producto en foco → agente → valida → guarda.
export async function atender(
  input: AtenderInput,
  deps: Deps = defaults,
): Promise<AtenderResultado> {
  const { canal, remitente } = input
  const tenantId = input.tenantId ?? 1
  // Guardrail capa 1: recortar payloads enormes antes de tocar el LLM.
  const mensaje = recortar(input.mensaje)

  // Takeover humano: si el asesor tomó esta conversación, registramos el
  // mensaje del cliente y NO respondemos (vale para WhatsApp y simulador).
  if (await deps.botPausado(remitente, tenantId)) {
    await deps.guardarMensaje(remitente, 'cliente', mensaje, null, tenantId)
    return { respuesta: '', etapa: 'atencion_humana', derivar: false, handoff: null, saved: null, silenciado: true }
  }

  // Rate-limit por remitente (anti denial-of-wallet / flood): 20/min → ignorar en silencio.
  if (deps.excedeRate(`${tenantId}:${remitente}`)) {
    await deps.guardarMensaje(remitente, 'cliente', mensaje, null, tenantId)
    return { respuesta: '', etapa: 'rate_limited', derivar: false, handoff: null, saved: null, silenciado: true }
  }

  // Carga temprana del negocio: necesario para el gate de allowlist y para modo_venta.
  // Se hace aquí (antes de extraer/buscar/LLM) para no gastar tokens con no-autorizados.
  const negocio = await deps.obtenerNegocio(tenantId)
  const modo = negocio.modo_venta ?? modoVenta()

  // Gate de suspensión: si el tenant está suspendido, silenciar sin gastar LLM.
  if (!(await deps.tenantActivo(tenantId))) {
    await deps.guardarMensaje(remitente, 'cliente', mensaje, null, tenantId)
    return { respuesta: '', etapa: 'suspendido', derivar: false, handoff: null, saved: null, silenciado: true }
  }

  // Gate allowlist (modo privado): si el tenant lo activa, solo responde a números autorizados.
  if (negocio.allowlist_activo && !(await deps.numeroAutorizado(input.telefono ?? remitente, tenantId))) {
    await deps.guardarMensaje(remitente, 'cliente', mensaje, null, tenantId)
    return { respuesta: '', etapa: 'no_autorizado', derivar: false, handoff: null, saved: null, silenciado: true }
  }

  // Auto-asignación del lead (best-effort: nunca bloquea la respuesta del agente).
  // Va DESPUÉS de los gates de suspensión/allowlist: solo asignamos leads que el agente
  // realmente va a atender (no malgastar saturación ni crear filas CRM de números ignorados).
  try {
    await deps.asignarNuevoLead(remitente, tenantId)
  } catch (e) {
    console.error('[atender] asignarNuevoLead falló (se ignora):', e)
  }

  // Gate de límite de plan: free/trial excedido → silenciar; pago excedido → seguir (se avisa).
  // El consumo se registra aquí (una vez, best-effort) por toda interacción que pasa el gate
  // y va a generar respuesta — evita duplicar el registro en cada fast-path (saludo, inyección, LLM).
  const { plan, sub_estado } = await deps.obtenerTenantPlan(tenantId)
  const lim = await deps.estadoLimite(tenantId, plan, sub_estado)
  if (lim.bloquear) {
    await deps.guardarMensaje(remitente, 'cliente', mensaje, null, tenantId)
    return { respuesta: '', etapa: 'limite_excedido', derivar: false, handoff: null, saved: null, silenciado: true }
  }
  // Registro de consumo best-effort: no crashea atender si falla.
  try { await deps.registrarConsumo(tenantId, { mensajes: 1 }) } catch (e) { console.error('[atender] registrarConsumo falló:', e) }

  // Guarda el teléfono real (resuelto del LID) dentro de extra, para mostrarlo en el dashboard.
  const conTel = (extra: Record<string, unknown>): Record<string, unknown> =>
    input.telefono ? { ...extra, _tel: input.telefono } : extra

  // Perfil del agente: cargado tempranamente para que los fast-paths (inyección,
  // saludo) puedan usar el nombre/negocio del tenant sin filtrar marca "Nina".
  const perfil = await deps.obtenerPerfil(tenantId)

  // Guardrail capa 1: cortocircuito ante inyección de prompt / jailbreak.
  // Respondemos en personaje sin llamar al LLM, y preservamos el estado del lead:
  // un turno troll no destruye el score/producto de un comprador que venía caliente.
  if (inyeccionDetectada(mensaje)) {
    const previo = await deps.ultimoPedido(remitente, tenantId)
    const msgSeguro = respuestaSegura(perfil.nombreBot, perfil.negocioNombre)
    await deps.guardarMensaje(remitente, 'cliente', mensaje, null, tenantId)
    await deps.guardarMensaje(remitente, 'bot', msgSeguro, 'enganche', tenantId)
    const row: PedidoGuardado = {
      producto: previo?.producto ?? null, color: null, talla: null, cantidad: null,
      extra: conTel({}), necesita_aclaracion: false,
      temperatura: previo?.temperatura ?? 'frio',
      score: previo?.score ?? 0,
      razon: 'intento de inyección de prompt bloqueado (estado del lead preservado)',
      canal, remitente, mensaje_crudo: mensaje,
      derivar: false, estado: previo?.derivar ? 'derivado' : 'nuevo',
    }
    const saved = await deps.insertPedido(row, tenantId)
    return { respuesta: msgSeguro, etapa: 'enganche', derivar: false, handoff: null, saved }
  }

  // C3 opt-out: el cliente pide no recibir más seguimientos/promos → marcar y confirmar.
  if (esOptOut(mensaje)) {
    try { await deps.marcarOptout?.(remitente, true, tenantId) } catch (e) { console.error('[atender] marcarOptout falló:', e) }
    const msgOptout = 'Listo, no te enviaré más mensajes de seguimiento 🙌 Si necesitas algo, escribime cuando quieras.'
    await deps.guardarMensaje(remitente, 'cliente', mensaje, null, tenantId)
    await deps.guardarMensaje(remitente, 'bot', msgOptout, 'enganche', tenantId)
    return { respuesta: msgOptout, etapa: 'enganche', derivar: false, handoff: null, saved: null }
  }

  // 1) memoria híbrida: ventana reciente (configurable por inquilino) + resumen rodante previo
  const ventana = await deps.obtenerVentanaTurnos(tenantId)
  const historial = await deps.cargarHistorial(remitente, tenantId, undefined, ventana)
  const resumenPrevio = (await deps.obtenerResumen(remitente, tenantId))?.resumen ?? null

  // Primer contacto con saludo genérico → bienvenida fija, sin gastar LLM.
  if (!historial.length && SALUDO_RE.test(mensaje.trim())) {
    const msgBienvenida = bienvenidaDe(perfil.nombreBot, perfil.negocioNombre, perfil.saludoInicial)
    await deps.guardarMensaje(remitente, 'cliente', mensaje, null, tenantId)
    await deps.guardarMensaje(remitente, 'bot', msgBienvenida, 'enganche', tenantId)
    const row: PedidoGuardado = {
      producto: null, color: null, talla: null, cantidad: null,
      extra: conTel({}), necesita_aclaracion: false,
      temperatura: 'frio', score: 15, razon: 'saludo inicial sin producto',
      canal, remitente, mensaje_crudo: mensaje, derivar: false, estado: 'nuevo',
    }
    const saved = await deps.insertPedido(row, tenantId)
    return { respuesta: msgBienvenida, etapa: 'enganche', derivar: false, handoff: null, saved }
  }

  // Acumulador de tokens del turno (medición de consumo, best-effort).
  let tokensTurno = 0
  const onTok = (t: number) => { tokensTurno += t }

  // 2) producto limpio (extracción con contexto) + producto en foco persistente
  const pedido = await deps.extraer(mensaje, historial.slice(-4), undefined, onTok)
  const previo = pedido.producto ? null : await deps.ultimoPedido(remitente, tenantId)
  const foco = pedido.producto ?? previo?.producto ?? null

  // 3) grounding de catálogo: búsqueda híbrida top-5 (léxico+typos+vectorial, sin tokens de LLM)
  const matches = await deps.buscarProductos(foco, tenantId)

  // 3.5) inferencia: si no hubo match y hay un foco, mapear la consulta a categorías
  // reales del catálogo y re-buscar (+1 LLM y +1 query SOLO en este caso de vacío).
  let matchesFinal = matches
  let alternativaDe: string | undefined
  if (matches.length === 0 && foco) {
    const categorias = await deps.categoriasDelCatalogo(tenantId)
    const ref = await deps.reformularConsulta({ consulta: foco, categorias })
    if (ref.hayMapeo && ref.terminos.length) {
      const alt = await deps.buscarProductos(ref.terminos.join(' '), tenantId)
      if (alt.length) { matchesFinal = alt; alternativaDe = foco }
    }
  }

  // Tiendas del inquilino (puntos de recojo): si hay, el agente puede cerrar venta/reserva.
  const tiendas = await deps.listarTiendas(tenantId, undefined, true)

  // B4 frictionless: datos ya conocidos del cliente (para no re-preguntar nombre/ciudad).
  const contactoActual = (await deps.obtenerContacto?.(remitente, tenantId)) ?? null
  const contacto = contactoActual ? { nombre: contactoActual.nombre, ciudad: contactoActual.ciudad } : undefined
  const pago = { yape: negocio.yape, plin: negocio.plin, titular: negocio.titular, titularYape: negocio.titular_yape, titularPlin: negocio.titular_plin, titularCuenta: negocio.titular_cuenta, banco: negocio.banco, cuenta: negocio.cuenta, tipoCuenta: negocio.tipo_cuenta, cci: negocio.cci }

  // Comprobante de pago (visión): comparar el monto pagado vs el total (producto × cantidad).
  let comprobante: { monto: number; total: number; ok: boolean; falta: number } | undefined
  if (input.comprobante?.monto != null && matchesFinal[0]) {
    const cantidad = pedido.cantidad ?? 1
    const total = Number(matchesFinal[0].precio) * cantidad
    // Acumula pagos: si antes pagó de menos y ahora envía un segundo Yape por la
    // diferencia, sumamos los comprobantes previos del historial al actual.
    const acumulado = Math.round((pagosPrevios(historial) + input.comprobante.monto) * 100) / 100
    const v = verificarPago(acumulado, total)
    comprobante = { monto: acumulado, total, ok: v.ok, falta: v.falta }
  }

  // 4) el agente conversacional decide la respuesta + estado del lead
  let conv = await deps.conversar({ mensaje, historial, matches: matchesFinal, modo, perfil, onUsage: onTok, alternativaDe, resumenPrevio: resumenPrevio ?? undefined, tiendas, contacto, pago, comprobante })
  let respuesta = sanitizarRespuesta(conv.respuesta)

  // Capa 3: si citó un precio que no está en el catálogo inyectado, un reintento con corrección.
  // Si el reintento también falla (proveedor caído), respuesta segura determinista: nunca
  // dejamos salir un precio fantasma ni crasheamos el turno.
  // Con comprobante de pago, el agente menciona montos (total/faltante) que no son del
  // catálogo → no aplicar el guardrail de precio-fantasma en ese caso.
  if (!input.comprobante && precioFantasma(respuesta, matchesFinal)) {
    try {
      conv = await deps.conversar({
        mensaje, historial, matches: matchesFinal, modo, perfil, onUsage: onTok, alternativaDe, resumenPrevio: resumenPrevio ?? undefined, tiendas, contacto, pago, comprobante,
        nota: matchesFinal.length
          ? 'Tu borrador citó un precio que NO está en PRODUCTOS_ENCONTRADOS. Usá SOLO los precios exactos de la lista (o sus totales por cantidad).'
          : 'Tu borrador citó un precio, pero NO hay PRODUCTOS_ENCONTRADOS: no des ningún precio ni nombres productos; ofrecé categorías reales o derivá.',
      })
      respuesta = sanitizarRespuesta(conv.respuesta)
    } catch {
      respuesta =
        'Ese precio exacto prefiero que te lo confirme un asesor por este mismo chat, así no te doy un dato errado 🌱 ¿Te conecto?'
    }
    if (precioFantasma(respuesta, matchesFinal)) {
      respuesta =
        'Ese precio exacto prefiero que te lo confirme un asesor por este mismo chat, así no te doy un dato errado 🌱 ¿Te conecto?'
    }
  }

  // Registrar los tokens consumidos por el turno LLM (observabilidad, best-effort).
  if (tokensTurno > 0) {
    try { await deps.registrarConsumo(tenantId, { tokens: tokensTurno }) }
    catch (e) { console.error('[atender] registrarConsumo (tokens) falló:', e) }
  }

  // Antifraude: si el bot emitió una forma de pago no configurada (alucinación), sanear + alertar.
  if (detectarPagoNoAutorizado(respuesta, negocio).fraude) {
    await deps.registrarAlertaFraude({ tenantId, remitente, autor: 'bot', texto: respuesta, telefono: input.telefono })
    respuesta = 'Para el pago te coordina un asesor en un momento 🙌'
  }

  // B6 escalada: ante un tema sensible (reclamo/fraude/no-entrega/reembolso) forzamos
  // derivación a humano con contexto, sin depender de que el LLM lo haya detectado.
  if (requiereEscalada(mensaje)) {
    conv.derivar = true
    conv.etapa = 'derivacion'
    conv.handoff = (conv.handoff ? `${conv.handoff} · ` : '') + resumenEscalada(mensaje)
  }

  // 5) persistir el turno (memoria) y el pedido (para el dashboard)
  await deps.guardarMensaje(remitente, 'cliente', mensaje, null, tenantId)
  await deps.guardarMensaje(remitente, 'bot', respuesta, conv.etapa, tenantId)

  const row: PedidoGuardado = {
    ...pedido,
    producto: pedido.producto ?? foco,
    extra: conTel(pedido.extra),
    temperatura: temperaturaDe(conv.score),
    score: conv.score,
    razon: conv.razon,
    canal,
    remitente,
    mensaje_crudo: mensaje,
    derivar: conv.derivar,
    estado: conv.derivar ? 'derivado' : 'nuevo',
  }
  const saved = await deps.insertPedido(row, tenantId)

  // Cierre automático venta/reserva (si el negocio lo tiene activado, default true).
  // Detección DETERMINISTA (forma+tienda en el mensaje, + lo que el LLM proponga);
  // el código VALIDA (tienda real + stock>0 + no duplicar) antes de registrar. Best-effort.
  // En modo manual (cierre_auto=false), el asesor lo cierra desde el CRM.
  // No auto-cerrar si el comprobante mostró pago incompleto (se reclama la diferencia).
  if (negocio.cierre_auto !== false && tiendas.length && !(comprobante && !comprobante.ok)) {
    try {
      let det = detectarCierreAuto(mensaje, conv.cierre, tiendas)
      // Comprobante verificado OK = pago confirmado → cerrar venta con la tienda que propuso el LLM.
      if (!det && comprobante?.ok && conv.cierre?.tienda) det = { tipo: 'venta', tiendaNombre: conv.cierre.tienda }
      if (det) {
        const tienda = await deps.tiendaPorNombre(tenantId, det.tiendaNombre)
        const productoMatch = matchesFinal[0]
        const stockOk = !!productoMatch && Number(productoMatch.stock) > 0
        const yaCerrado = (await deps.cierresPorRemitente(tenantId)).get(remitente)
        const activo = yaCerrado && (yaCerrado.estado === 'ganado' || yaCerrado.estado === 'reservada')
        if (tienda && stockOk && !activo) {
          const cantidad = pedido.cantidad ?? 1
          const monto = productoMatch ? Number(productoMatch.precio) * cantidad : null
          const estado = det.tipo === 'venta' ? 'ganado' : 'reservada'
          await deps.registrarCierre(remitente, estado, monto, 'cierre automático del agente', tenantId, undefined, {
            tipo: det.tipo, tiendaId: tienda.id,
          })
        }
      }
    } catch (e) {
      console.error('[atender] registro de cierre automático falló (se ignora):', e)
    }
  }

  // Auto-etiquetas que Nina detectó en este turno (best-effort: no rompe el turno).
  for (const e of conv.etiquetas ?? []) {
    try {
      await deps.agregarEtiqueta(remitente, e, 'auto', tenantId)
    } catch {
      /* la etiqueta no es crítica */
    }
  }

  // Ficha de contacto cero-data-entry: persiste lo que el cliente dio en el turno.
  try {
    const ex = pedido.extra as Record<string, unknown>
    const texto = (k: string) => (typeof ex[k] === 'string' && (ex[k] as string).trim() ? (ex[k] as string) : null)
    await deps.enriquecerContacto(remitente, {
      nombre: texto('nombre'),
      ciudad: texto('ciudad') ?? texto('zona') ?? texto('distrito'),
      telefono: input.telefono ?? null,
      producto: pedido.producto ?? foco,
    }, tenantId)
  } catch {
    /* el contacto no es crítico */
  }

  // Memoria de largo plazo: regenerar el resumen rodante de forma diferida
  // (fire-and-forget, no suma latencia; en el worker el proceso vive y corre).
  void deps.quizasResumir(remitente, tenantId, undefined, undefined, ventana).catch(() => {})

  return {
    respuesta,
    etapa: conv.etapa,
    derivar: conv.derivar,
    handoff: conv.handoff,
    saved,
  }
}
