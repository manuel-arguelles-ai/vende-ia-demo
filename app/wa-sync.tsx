'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Lock, CheckCircle2, Loader2, X } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { conBase } from '@/lib/base'
import { useEscapeKey } from '@/lib/ui/useEscapeKey'
import { ItemBoton } from './sidebar-ui'

type Estado = { connected: boolean; qr: string | null; disponible?: boolean; motivo?: string; error?: string }

// Botón del sidebar + modal para vincular/monitorear WhatsApp (escaneo del QR).
export function WaSync({ colapsado, onUpgrade }: { colapsado: boolean; onUpgrade?: () => void }) {
  const [open, setOpen] = useState(false)
  const [estado, setEstado] = useState<Estado | null>(null)
  const [cargando, setCargando] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const detenerRef = useRef(false)
  useEffect(() => {
    // No seguir refrescando si ya conectó o si el plan no habilita WhatsApp.
    detenerRef.current = !!estado?.connected || estado?.disponible === false
  }, [estado])

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const r = await fetch(conBase('/api/wa-estado'), { cache: 'no-store' })
      setEstado(await r.json())
    } catch {
      setEstado({ connected: false, qr: null, error: 'no se pudo consultar' })
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      if (timer.current) clearInterval(timer.current)
      return
    }
    // setTimeout(0) para no llamar setState sincrónicamente dentro del effect.
    const t0 = setTimeout(() => cargar(), 0)
    // Refresca cada 4s mientras esté abierto y no conectado (el QR rota solo).
    timer.current = setInterval(() => {
      if (!detenerRef.current) cargar()
    }, 4000)
    return () => {
      clearTimeout(t0)
      if (timer.current) clearInterval(timer.current)
    }
  }, [open, cargar])

  const conectado = estado?.connected
  useEscapeKey(open, () => setOpen(false))

  return (
    <>
      <ItemBoton
        icono={FaWhatsapp}
        label="WhatsApp"
        colapsado={colapsado}
        onClick={() => setOpen(true)}
        puntoEstado={conectado ? 'verde' : 'ambar'}
      />

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sincronizar WhatsApp"
            className="w-full max-w-sm rounded-2xl border border-line bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Sincronizar WhatsApp</h2>
              <button onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-muted hover:bg-paper-2 hover:text-ink">
                <X size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </div>

            {estado?.disponible === false ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <Lock size={30} strokeWidth={1.75} className="text-muted" aria-hidden />
                <p className="font-semibold text-ink">WhatsApp es parte de los planes Pro y Max</p>
                <p className="text-sm text-muted">
                  En tu plan actual puedes usar el <b>widget web</b>. Mejora tu plan para
                  conectar el WhatsApp de tu negocio y atender por ahí.
                </p>
                <button
                  onClick={() => {
                    setOpen(false)
                    onUpgrade?.()
                  }}
                  className="mt-1 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-paper"
                >
                  Mejorar plan
                </button>
              </div>
            ) : conectado ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle2 size={30} strokeWidth={1.75} className="text-emerald-500" aria-hidden />
                <p className="font-semibold text-emerald-600">WhatsApp conectado</p>
                <p className="text-sm text-muted">El bot está escuchando mensajes.</p>
              </div>
            ) : estado?.qr ? (
              <div className="flex flex-col items-center gap-3 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={estado.qr} alt="QR de WhatsApp" width={240} height={240} className="rounded-lg border border-line" />
                <p className="text-sm text-muted">
                  Escanea este QR con el <b>WhatsApp de tu negocio</b>: WhatsApp → <b>Dispositivos vinculados</b> → <b>Vincular un dispositivo</b>.
                </p>
                <p className="text-[11px] text-muted">El código se refresca solo. {cargando ? 'Actualizando…' : ''}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Loader2 size={26} strokeWidth={1.75} className="animate-spin text-muted" aria-hidden />
                <p className="text-sm text-muted">
                  {estado?.error ? `No se pudo conectar con el worker (${estado.error}).` : 'Generando código QR…'}
                </p>
                <button onClick={cargar} className="mt-1 rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-paper">
                  Reintentar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
