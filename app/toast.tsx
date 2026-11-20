'use client'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Tipo = 'ok' | 'error' | 'info'
type Toast = { id: number; tipo: Tipo; texto: string }
type ToastApi = { ok: (t: string) => void; error: (t: string) => void; info: (t: string) => void }

const ToastCtx = createContext<ToastApi | null>(null)

// Hook de toasts. Si no hay provider (no debería pasar), no rompe: no-op.
export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx)
  return ctx ?? { ok: () => {}, error: () => {}, info: () => {} }
}

const ESTILO: Record<Tipo, string> = {
  ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  error: 'border-red-500/30 bg-red-500/10 text-red-700',
  info: 'border-line bg-card text-ink',
}
const ICONO: Record<Tipo, string> = { ok: '✓', error: '⚠', info: 'ℹ' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const quitar = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (tipo: Tipo, texto: string) => {
      // id único sin Date.now() repetido: contador por timestamp + random ligero.
      const id = Math.floor(performance.now() * 1000) + Math.floor(Math.random() * 1000)
      setToasts((prev) => [...prev, { id, tipo, texto }])
      setTimeout(() => quitar(id), 3500)
    },
    [quitar],
  )

  const api: ToastApi = {
    ok: (t) => push('ok', t),
    error: (t) => push('error', t),
    info: (t) => push('info', t),
  }

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 left-4 z-[100] flex flex-col items-end gap-2 sm:left-auto" aria-live="polite" role="status">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => quitar(t.id)}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium shadow-lg backdrop-blur transition sm:w-auto ${ESTILO[t.tipo]}`}
          >
            <span aria-hidden className="text-base leading-none">{ICONO[t.tipo]}</span>
            <span className="text-left">{t.texto}</span>
          </button>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
