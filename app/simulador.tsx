'use client'
import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { conBase } from '@/lib/base'
import { useTenantInfo } from './use-tenant-info'

export function Simulador({ onProcesado }: { onProcesado?: () => void }) {
  const bot = useTenantInfo()?.nombreBot ?? 'tu asistente'
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)

  async function enviar() {
    if (!mensaje.trim() || cargando) return
    setCargando(true)
    try {
      await fetch(conBase('/api/procesar'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mensaje }),
      })
      setMensaje('')
      onProcesado?.()
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Sparkles size={16} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-coral" />
        <input
          className="w-full rounded-full border border-coral-soft bg-[#f0fcfd] py-2.5 pl-9 pr-4 text-sm shadow-[0_1px_2px_rgba(33,31,26,0.04)] outline-none transition placeholder:text-muted focus:border-coral focus:ring-2 focus:ring-coral/20"
          placeholder="Prueba al agente: «busco algo para el estrés»"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()}
        />
      </div>
      <button
        className="rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-white shadow-[0_1px_2px_rgba(33,31,26,0.1)] transition hover:brightness-95 disabled:opacity-50"
        onClick={enviar}
        disabled={cargando}
      >
        {cargando ? `${bot} escribe…` : 'Enviar'}
      </button>
    </div>
  )
}
