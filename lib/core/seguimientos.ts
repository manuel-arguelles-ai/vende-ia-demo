// B1/B5 — Motor de seguimiento proactivo (re-enganche de cotización abandonada + postventa).
// SELECTOR PURO: decide a quién tocar, con qué toque y cuándo. No envía ni toca la BD.
// El envío real vive en el worker, GATEADO por un flag por-inquilino (apagado por defecto).
//
// Reglas (de la investigación destilada):
// - Re-enganche: lead abierto (sin cierre), caliente/derivado, donde NOSOTROS hablamos último
//   (esperando al cliente). Toques a +45min / +24h / +48h; cap a 96h. Cualquier respuesta del
//   cliente cancela los toques restantes (queda como ultimoRol='cliente'). Descuento SOLO en el 3º.
// - Postventa: cierre ganado hace 14-30 días → un check-in de lectura + cross-sell.
// - Anti-invasivo: máximo 1 toque por lead por corrida, solo en horario 9-21h local, respeta opt-out,
//   y nunca repite un toque ya enviado.

export type LeadSeguimiento = {
  remitente: string
  score: number | null
  derivado: boolean
  cierreEstado: 'ganado' | 'reservada' | 'perdido' | null
  ultimoRol: 'cliente' | 'bot' | 'asesor'
  ultimoAtMs: number // timestamp del último mensaje
  ganadoAtMs?: number | null // timestamp del cierre ganado (para postventa)
  optout?: boolean
  nombre?: string | null
  producto?: string | null
}

export type TipoToque = 'reenganche' | 'postventa'
export type Seguimiento = { remitente: string; tipo: TipoToque; toque: number }

const H = 3600_000
const VENTANAS = [0.75 * H, 24 * H, 48 * H] // inicios de los toques 1, 2, 3
const TOPE = 96 * H

// C3 — el cliente pide no recibir más seguimientos/promos ("baja"). Frases específicas
// para no confundir con "precio bajo" o "temporada baja".
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
const OPTOUT = [
  'darme de baja', 'me doy de baja', 'dar de baja', 'desuscrib', 'no me escriban',
  'no me escribas', 'dejen de escribir', 'deja de escribirme', 'deja de enviarme',
  'no me envien', 'no quiero mas mensajes', 'no quiero promociones', 'no me molesten',
]
export function esOptOut(mensaje: string): boolean {
  const t = norm(mensaje)
  if (t === 'stop' || t === 'baja') return true
  return OPTOUT.some((k) => t.includes(k))
}

export type OpcionesSeguimiento = {
  ahoraMs: number
  horaLocal: number // 0-23, hora local del negocio
  apertura?: number // hora desde la que se puede enviar (default 9)
  cierre?: number // hora hasta la que se puede enviar, exclusiva (default 21)
  // enviados: por remitente, set de claves "reenganche:1", "postventa:1" ya enviadas
  enviados?: Map<string, Set<string>>
}

// Deriva la ventana horaria de envío del horario configurado del negocio (texto libre,
// ej. "08:00 - 18:00", "Lun-Sáb 9am a 7pm"). Toma las dos primeras horas como apertura/cierre.
// CLAMP de seguridad [8, 21]: nunca se envía de madrugada aunque el horario diga otra cosa.
export function ventanaHoraria(horario?: string | null): { apertura: number; cierre: number } {
  const def = { apertura: 9, cierre: 20 }
  if (!horario) return def
  const tokens = [...horario.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi)]
  const horas: number[] = []
  for (const m of tokens) {
    let h = Number(m[1])
    const ampm = m[3]?.toLowerCase()
    if (ampm === 'pm' && h !== 12) h += 12
    if (ampm === 'am' && h === 12) h = 0
    if (h >= 0 && h <= 23) horas.push(h)
    if (horas.length === 2) break
  }
  if (horas.length < 2 || horas[1] <= horas[0]) return def
  return { apertura: Math.max(8, horas[0]), cierre: Math.min(21, horas[1]) }
}

function yaEnviado(env: Map<string, Set<string>> | undefined, rem: string, clave: string): boolean {
  return !!env?.get(rem)?.has(clave)
}

export function seleccionarSeguimientos(leads: LeadSeguimiento[], o: OpcionesSeguimiento): Seguimiento[] {
  const out: Seguimiento[] = []
  const apertura = o.apertura ?? 9
  const cierre = o.cierre ?? 21
  if (o.horaLocal < apertura || o.horaLocal >= cierre) return out // fuera del horario del negocio: nada
  for (const l of leads) {
    if (l.optout) continue

    // Postventa: cierre ganado hace 14-30 días, un solo toque.
    if (l.cierreEstado === 'ganado' && l.ganadoAtMs) {
      const dias = (o.ahoraMs - l.ganadoAtMs) / (24 * H)
      if (dias >= 14 && dias <= 30 && !yaEnviado(o.enviados, l.remitente, 'postventa:1')) {
        out.push({ remitente: l.remitente, tipo: 'postventa', toque: 1 })
      }
      continue // un lead ganado no entra al re-enganche
    }

    // Re-enganche: solo leads ABIERTOS, calientes/derivados, esperando al cliente.
    if (l.cierreEstado === 'ganado' || l.cierreEstado === 'reservada') continue
    if (l.ultimoRol === 'cliente') continue // la pelota la tiene el cliente: no interrumpir
    const caliente = (l.score ?? 0) >= 46 || l.derivado
    if (!caliente) continue

    const transcurrido = o.ahoraMs - l.ultimoAtMs
    if (transcurrido > TOPE) continue
    // El toque aplicable más alto cuya ventana ya abrió y aún no se envió.
    for (let t = VENTANAS.length; t >= 1; t--) {
      if (transcurrido >= VENTANAS[t - 1] && !yaEnviado(o.enviados, l.remitente, `reenganche:${t}`)) {
        out.push({ remitente: l.remitente, tipo: 'reenganche', toque: t })
        break
      }
    }
  }
  return out
}

// Plantilla del mensaje a enviar. Texto plano WhatsApp, 1 CTA. Descuento solo en el toque 3.
export function plantillaSeguimiento(
  s: Seguimiento,
  v: { nombre?: string | null; producto?: string | null; negocio?: string | null },
): string {
  const nom = v.nombre ? ` ${v.nombre}` : ''
  const prod = v.producto ? `*${v.producto}*` : 'lo que viste'
  if (s.tipo === 'postventa') {
    return `Hola${nom} 👋 ¿Cómo vas con ${prod}? Si te gustó, tengo un par de títulos que combinan perfecto. ¿Te los muestro?`
  }
  if (s.toque === 1) return `Hola${nom} 👋 Te dejé apartado ${prod}. ¿Lo cerramos? Cualquier duda, acá estoy 🙂`
  if (s.toque === 2) return `Hola${nom}, ${prod} sigue disponible y es de los más pedidos del mes 📚 ¿Te lo coordino hoy?`
  return `Última llamada para ${prod}${nom} ⏳ Quedan pocas unidades; si confirmás hoy te ayudo con el envío. ¿Lo aseguro?`
}
