'use client'
import { useState } from 'react'
import { conBase } from '@/lib/base'

// Borradores IA para el asesor (next-best-action): 3 opciones con intención
// distinta. Click → rellena el composer SIN enviar (el humano personaliza).
type Sugerencia = { intencion: 'responder' | 'objecion' | 'cierre'; texto: string }

const INTENCION = {
  responder: { label: 'Responder', cls: 'bg-[var(--frio-soft)] text-[var(--frio)]' },
  objecion: { label: 'Objeción', cls: 'bg-[var(--tibio-soft)] text-[var(--tibio)]' },
  cierre: { label: 'Cierre', cls: 'bg-coral-soft text-coral' },
} as const

export function Sugerencias({
  remitente,
  onElegir,
  plano = false,
}: {
  remitente: string
  onElegir: (t: string) => void
  // plano: sin fondo/borde propio (para usar dentro de una card del copiloto)
  plano?: boolean
}) {
  const [sugs, setSugs] = useState<Sugerencia[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(false)

  async function generar() {
    setCargando(true)
    setError(false)
    try {
      const res = await fetch(conBase('/api/sugerencias'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ remitente }),
      })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { sugerencias: Sugerencia[] }
      setSugs(data.sugerencias)
    } catch {
      setError(true)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className={plano ? 'mt-2' : 'border-t border-line bg-paper-2/40 px-2.5 py-2'}>
      <div className="flex items-center justify-between">
        <button
          onClick={generar}
          disabled={cargando}
          className="rounded-full bg-paper-2 px-3 py-1 text-xs font-bold text-ink transition hover:bg-line disabled:opacity-50"
        >
          {cargando ? 'pensando…' : sugs ? '↻ regenerar' : '✨ Sugerir respuestas'}
        </button>
        {error && <span className="text-xs font-semibold text-coral">no se pudo generar</span>}
      </div>
      {/* Altura acotada con scroll propio: las sugerencias no aplastan el chat,
          y al elegir una se colapsan (el borrador queda en el composer). */}
      {sugs && !cargando && (
        <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto">
          {sugs.map((s, i) => (
            <button
              key={i}
              onClick={() => {
                onElegir(s.texto)
                setSugs(null)
              }}
              title="usar como borrador"
              className="w-full rounded-xl border border-line bg-white p-2 text-left transition hover:border-coral"
            >
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${INTENCION[s.intencion].cls}`}>
                {INTENCION[s.intencion].label}
              </span>
              <p className="mt-1 text-[12.5px] leading-snug text-ink">{s.texto}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
