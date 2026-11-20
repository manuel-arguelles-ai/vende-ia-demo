import type { Conversacion } from '@/lib/core/conversaciones'

// Rango de prioridad para la lista única del asesor (menor = más arriba).
// vencido > caliente sin atender > derivado > en atención > resto > cerrado.
export function prioridadLead(c: Conversacion, ahora: number): number {
  if (c.cierre) return 5
  if (c.recordatorio && new Date(c.recordatorio).getTime() <= ahora) return 0 // seguimiento vencido
  if (c.temperatura === 'caliente' && !c.enAtencion) return 1
  if (c.derivado) return 2
  if (c.enAtencion) return 3
  return 4
}

// Ordena los leads del asesor por prioridad; empate → más reciente primero.
export function ordenarLeadsAsesor(convs: Conversacion[], ahora: number): Conversacion[] {
  return [...convs].sort((a, b) => {
    const pa = prioridadLead(a, ahora)
    const pb = prioridadLead(b, ahora)
    if (pa !== pb) return pa - pb
    const ta = a.ultimoAt ? new Date(a.ultimoAt).getTime() : 0
    const tb = b.ultimoAt ? new Date(b.ultimoAt).getTime() : 0
    return tb - ta
  })
}
