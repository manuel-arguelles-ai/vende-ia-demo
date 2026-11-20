import { jidANumero } from './handoff'
import type { Etiqueta } from './etiquetas'
import type { Contacto } from './contactos'
import type { Cierre } from './gestion'

export type MensajeRow = {
  remitente: string
  rol: 'cliente' | 'bot' | 'asesor'
  texto: string
  etapa: string | null
  created_at: string
  imagen_url?: string | null
}

export type PedidoLite = {
  remitente: string
  temperatura: 'caliente' | 'tibio' | 'frio'
  score: number
  derivar: boolean
  producto: string | null
  estado: string | null
  extra: Record<string, unknown> | null
  created_at: string
}

export type Conversacion = {
  remitente: string
  numero: string
  turnos: { rol: 'cliente' | 'bot' | 'asesor'; texto: string; etapa: string | null; created_at: string; imagen_url?: string | null }[]
  ultimoAt: string
  etapa: string | null
  temperatura: 'caliente' | 'tibio' | 'frio' | null
  score: number | null
  derivar: boolean
  derivado: boolean
  producto: string | null
  zona: string | null
  // true = takeover: un asesor tomó la conversación y el bot está pausado
  enAtencion: boolean
  etiquetas: Etiqueta[]
  // F2: ficha enriquecida + ciclo de venta + follow-up
  nombre: string | null
  cierre: Cierre | null
  recordatorio: string | null // próximo recordatorio pendiente (ISO) o null
}

// Busca una zona de envío en el blob `extra` del pedido (best-effort).
function zonaDe(extra: Record<string, unknown> | null | undefined): string | null {
  if (!extra) return null
  for (const k of ['zona', 'envio', 'distrito', 'direccion', 'ciudad', 'departamento']) {
    const v = extra[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

// Agrupa los mensajes (uno por turno) en conversaciones por remitente, ordenadas
// por actividad más reciente. Adjunta el estado del último pedido del cliente
// (temperatura/score/etapa) y el último producto de interés mencionado.
export function agruparConversaciones(
  mensajes: MensajeRow[],
  pedidos: PedidoLite[] = [],
  pausados: Set<string> = new Set(),
  etiquetas: Map<string, Etiqueta[]> = new Map(),
  contactos: Map<string, Contacto> = new Map(),
  cierres: Map<string, Cierre> = new Map(),
  recordatorios: Map<string, string> = new Map(),
): Conversacion[] {
  // Pedidos por remitente, del más nuevo al más viejo (tal cual vienen de la BD).
  const pedidosPorRemitente = new Map<string, PedidoLite[]>()
  for (const p of pedidos) {
    const arr = pedidosPorRemitente.get(p.remitente) ?? []
    arr.push(p)
    pedidosPorRemitente.set(p.remitente, arr)
  }

  const porRemitente = new Map<string, MensajeRow[]>()
  for (const m of mensajes) {
    const arr = porRemitente.get(m.remitente) ?? []
    arr.push(m)
    porRemitente.set(m.remitente, arr)
  }

  const convs: Conversacion[] = []
  for (const [remitente, rows] of porRemitente) {
    const orden = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))
    const peds = pedidosPorRemitente.get(remitente) ?? []
    const ultimo = peds[0]
    const producto = peds.find((p) => p.producto && p.producto.trim())?.producto ?? null
    const ultimaEtapa = [...orden].reverse().find((t) => t.etapa)?.etapa ?? null
    // Teléfono real resuelto (el remitente puede ser un LID opaco, no el número).
    const telJid = peds.find((p) => typeof p.extra?._tel === 'string')?.extra?._tel as string | undefined
    convs.push({
      remitente,
      numero: jidANumero(telJid ?? remitente),
      turnos: orden.map((t) => ({ rol: t.rol, texto: t.texto, etapa: t.etapa, created_at: t.created_at, imagen_url: t.imagen_url ?? null })),
      ultimoAt: orden[orden.length - 1].created_at,
      etapa: ultimaEtapa,
      temperatura: ultimo?.temperatura ?? null,
      score: ultimo?.score ?? null,
      derivar: ultimo?.derivar ?? false,
      derivado: ultimo?.estado === 'derivado' || (ultimo?.derivar ?? false),
      producto,
      zona: zonaDe(ultimo?.extra),
      enAtencion: pausados.has(remitente),
      etiquetas: etiquetas.get(remitente) ?? [],
      nombre: contactos.get(remitente)?.nombre ?? null,
      cierre: cierres.get(remitente) ?? null,
      recordatorio: recordatorios.get(remitente) ?? null,
    })
  }

  return convs.sort((a, b) => b.ultimoAt.localeCompare(a.ultimoAt))
}
