'use client'
import { useEffect, useState, useCallback } from 'react'
import { conBase } from '@/lib/base'
import { telefonoMostrado } from '@/lib/core/handoff'
import { telefonoLead } from '@/lib/ui/lead'

type Alerta = {
  id: number; remitente: string; autor: string; texto: string
  numero_detectado: string | null; telefono: string | null; created_at: string; resuelta: boolean
}

// Vista admin: alertas de fraude de formas de pago (asesor o bot que intentó
// usar una forma de pago no configurada). El admin las revisa y resuelve.
export function AlertasVista({ onAbrirConversacion }: { onAbrirConversacion?: (remitente: string) => void }) {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const r = await fetch(conBase('/api/alertas'))
      if (r.ok) setAlertas(await r.json())
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function resolver(id: number) {
    await fetch(conBase('/api/alertas'), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    cargar()
  }

  if (cargando) return <p className="py-8 text-sm text-muted">cargando alertas…</p>

  const pendientes = alertas.filter((a) => !a.resuelta)
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {pendientes.length === 0
          ? 'Sin alertas pendientes. Acá aparecen los intentos de usar formas de pago no configuradas en Mi negocio.'
          : `${pendientes.length} alerta(s) pendiente(s) de revisión.`}
      </p>
      {alertas.map((a) => (
        <div
          key={a.id}
          onClick={() => onAbrirConversacion?.(a.remitente)}
          role="button"
          tabIndex={0}
          title="Ver la conversación"
          className={`cursor-pointer rounded-2xl border bg-card p-4 transition hover:border-coral ${a.resuelta ? 'border-line opacity-60' : 'border-coral/40'}`}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2 py-0.5 font-bold ${a.autor === 'bot' ? 'bg-paper-2 text-muted' : 'bg-coral-soft text-coral'}`}>
              {a.autor === 'bot' ? '🤖 bot' : '🧑‍💼 asesor'}
            </span>
            {a.numero_detectado && (
              <span className="rounded-full bg-coral-soft px-2 py-0.5 font-mono font-bold text-coral">N.º {a.numero_detectado}</span>
            )}
            <span className="text-muted">{telefonoLead(telefonoMostrado(a.telefono ?? a.remitente))}</span>
            <span className="text-muted">· {new Date(a.created_at).toLocaleString('es-PE')}</span>
            {a.resuelta && <span className="rounded-full bg-sage-soft px-2 py-0.5 font-bold text-sage">resuelta</span>}
          </div>
          <p className="mt-2 text-sm">{a.texto}</p>
          {!a.resuelta && (
            <button
              onClick={(e) => { e.stopPropagation(); resolver(a.id) }}
              className="mt-3 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper"
            >
              Marcar resuelta
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
