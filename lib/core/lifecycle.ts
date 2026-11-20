// B3 — Etapa del ciclo de vida del lead, DERIVADA del estado que ya guardamos
// (score + cierre + actividad). Sin columna nueva: se calcula on-the-fly.

export type EtapaLifecycle = 'nuevo' | 'interesado' | 'cotizado' | 'cliente' | 'recurrente' | 'dormido' | 'perdido'

export type LifecycleInput = {
  score: number | null
  derivado?: boolean
  cierreEstado?: 'ganado' | 'reservada' | 'perdido' | null
  comprasGanadas?: number // cuántos cierres ganados tiene (para recurrente)
  diasInactivo?: number | null // días desde el último mensaje
}

export function etapaLifecycle(i: LifecycleInput): EtapaLifecycle {
  if (i.cierreEstado === 'ganado') return (i.comprasGanadas ?? 1) >= 2 ? 'recurrente' : 'cliente'
  if (i.cierreEstado === 'perdido') return 'perdido'
  if (typeof i.diasInactivo === 'number' && i.diasInactivo > 30) return 'dormido'
  if (i.cierreEstado === 'reservada') return 'cotizado'
  if (i.derivado || (i.score ?? 0) >= 61) return 'cotizado'
  if ((i.score ?? 0) >= 26) return 'interesado'
  return 'nuevo'
}

export const LIFECYCLE_LABEL: Record<EtapaLifecycle, string> = {
  nuevo: 'Nuevo', interesado: 'Interesado', cotizado: 'Cotizado',
  cliente: 'Cliente', recurrente: 'Recurrente', dormido: 'Dormido', perdido: 'Perdido',
}
