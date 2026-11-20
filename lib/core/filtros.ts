import type { Conversacion } from './conversaciones'

// Filtros del pipeline (se aplican en el cliente: el dashboard ya tiene todo en memoria).
export type RangoUltima = '24h' | '3d' | '7d' | 'mas7d' | null

export type EstadoVenta = 'activos' | 'ganados' | 'perdidos' | 'todos'

export type Filtros = {
  q?: string // busca en número, nombre, producto, zona, etiquetas y texto de los mensajes
  etiqueta?: string | null
  ultima?: RangoUltima // antigüedad de la última comunicación
  estado?: EstadoVenta // default 'activos': oculta ganados/perdidos del pipeline
}

const HORA = 60 * 60 * 1000

function coincideUltima(c: Conversacion, rango: RangoUltima, ahoraMs: number): boolean {
  if (!rango) return true
  const hace = ahoraMs - new Date(c.ultimoAt).getTime()
  if (rango === '24h') return hace <= 24 * HORA
  if (rango === '3d') return hace <= 72 * HORA
  if (rango === '7d') return hace <= 7 * 24 * HORA
  return hace > 7 * 24 * HORA // 'mas7d' → necesita follow-up
}

export function filtrarConversaciones(
  convs: Conversacion[],
  f: Filtros,
  ahoraMs = Date.now(),
): Conversacion[] {
  const q = (f.q ?? '').trim().toLowerCase()
  const estado = f.estado ?? 'activos'
  return convs.filter((c) => {
    if (estado === 'activos' && c.cierre) return false
    if (estado === 'ganados' && c.cierre?.estado !== 'ganado') return false
    if (estado === 'perdidos' && c.cierre?.estado !== 'perdido') return false
    if (!coincideUltima(c, f.ultima ?? null, ahoraMs)) return false
    if (f.etiqueta && !c.etiquetas.some((e) => e.etiqueta === f.etiqueta)) return false
    if (!q) return true
    if (c.numero.toLowerCase().includes(q)) return true
    if (c.nombre?.toLowerCase().includes(q)) return true
    if (c.producto?.toLowerCase().includes(q)) return true
    if (c.zona?.toLowerCase().includes(q)) return true
    if (c.etiquetas.some((e) => e.etiqueta.includes(q))) return true
    return c.turnos.some((t) => t.texto.toLowerCase().includes(q))
  })
}
