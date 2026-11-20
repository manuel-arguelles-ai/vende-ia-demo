// Tiempos de respuesta calculados de los timestamps de `mensajes` (sin instrumentar).
// - agente: cliente → siguiente bot (mismo remitente)
// - asesor: bot/derivación → siguiente asesor (mismo remitente, takeover)
// - embudo: tiempo de respuesta del agente agrupado por la etapa del turno bot

export type MensajeTiempo = { remitente: string; rol: 'cliente' | 'bot' | 'asesor'; etapa: string | null; created_at: string }

export type Tiempos = {
  agenteMedianaS: number | null
  asesorMedianaS: number | null
  muestras: { agente: number; asesor: number }
  porEtapa: { etapa: string; medianaS: number; n: number }[]
}

function mediana(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

const dt = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 1000

export function tiemposRespuesta(mensajes: MensajeTiempo[]): Tiempos {
  // agrupar por remitente, orden cronológico
  const porRem = new Map<string, MensajeTiempo[]>()
  for (const m of mensajes) {
    const arr = porRem.get(m.remitente) ?? []
    arr.push(m)
    porRem.set(m.remitente, arr)
  }

  const agente: number[] = []
  const asesor: number[] = []
  const porEtapaRaw = new Map<string, number[]>()

  for (const arr of porRem.values()) {
    const ms = [...arr].sort((a, b) => a.created_at.localeCompare(b.created_at))
    for (let i = 1; i < ms.length; i++) {
      const prev = ms[i - 1], cur = ms[i]
      const d = dt(prev.created_at, cur.created_at)
      if (d < 0 || d > 86400) continue // ignora gaps > 24h (conversación retomada otro día)
      if (prev.rol === 'cliente' && cur.rol === 'bot') {
        agente.push(d)
        const et = cur.etapa ?? 'sin etapa'
        porEtapaRaw.set(et, [...(porEtapaRaw.get(et) ?? []), d])
      } else if ((prev.rol === 'bot' || prev.rol === 'cliente') && cur.rol === 'asesor') {
        asesor.push(d)
      }
    }
  }

  const porEtapa = [...porEtapaRaw.entries()]
    .map(([etapa, xs]) => ({ etapa, medianaS: mediana(xs) ?? 0, n: xs.length }))
    .sort((a, b) => b.n - a.n)

  return {
    agenteMedianaS: mediana(agente),
    asesorMedianaS: mediana(asesor),
    muestras: { agente: agente.length, asesor: asesor.length },
    porEtapa,
  }
}
