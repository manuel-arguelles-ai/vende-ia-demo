import { describe, it, expect } from 'vitest'
import { tiemposRespuesta, type MensajeTiempo } from '../tiempos'

const M = (remitente: string, rol: MensajeTiempo['rol'], etapa: string | null, t: string): MensajeTiempo =>
  ({ remitente, rol, etapa, created_at: t })

describe('tiemposRespuesta', () => {
  it('agente: cliente→bot, mediana en segundos + embudo por etapa', () => {
    const ms = [
      M('a', 'cliente', null, '2026-06-28T10:00:00Z'),
      M('a', 'bot', 'enganche', '2026-06-28T10:00:10Z'), // 10s
      M('a', 'cliente', null, '2026-06-28T10:01:00Z'),
      M('a', 'bot', 'cierre', '2026-06-28T10:01:30Z'),   // 30s
    ]
    const r = tiemposRespuesta(ms)
    expect(r.agenteMedianaS).toBe(20) // mediana de [10,30]
    expect(r.muestras.agente).toBe(2)
    expect(r.porEtapa.find((e) => e.etapa === 'enganche')?.medianaS).toBe(10)
    expect(r.porEtapa.find((e) => e.etapa === 'cierre')?.medianaS).toBe(30)
  })

  it('asesor: bot/cliente→asesor', () => {
    const ms = [
      M('b', 'cliente', null, '2026-06-28T10:00:00Z'),
      M('b', 'bot', 'derivacion', '2026-06-28T10:00:05Z'),
      M('b', 'asesor', null, '2026-06-28T10:02:05Z'), // 120s desde el bot
    ]
    const r = tiemposRespuesta(ms)
    expect(r.asesorMedianaS).toBe(120)
    expect(r.muestras.asesor).toBe(1)
  })

  it('ignora gaps > 24h', () => {
    const ms = [
      M('c', 'cliente', null, '2026-06-20T10:00:00Z'),
      M('c', 'bot', 'enganche', '2026-06-28T10:00:00Z'), // 8 días → ignorado
    ]
    expect(tiemposRespuesta(ms).agenteMedianaS).toBeNull()
  })

  it('sin datos → null', () => {
    expect(tiemposRespuesta([]).agenteMedianaS).toBeNull()
  })
})
