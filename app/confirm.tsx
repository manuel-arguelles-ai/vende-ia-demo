'use client'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { useEscapeKey } from '@/lib/ui/useEscapeKey'

type Opciones = { titulo: string; mensaje?: string; confirmar?: string; cancelar?: string; peligro?: boolean }
type ConfirmFn = (opts: Opciones) => Promise<boolean>

const ConfirmCtx = createContext<ConfirmFn | null>(null)

// Confirmación estilada (reemplaza window.confirm). Devuelve Promise<boolean>.
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmCtx)
  // Fallback al confirm nativo si no hay provider (no debería pasar).
  return ctx ?? (async (o) => window.confirm(o.titulo))
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<Opciones | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const cerrar = useCallback((v: boolean) => {
    resolver.current?.(v)
    resolver.current = null
    setOpts(null)
  }, [])

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  useEscapeKey(opts !== null, () => cerrar(false))

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          onClick={() => cerrar(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={opts.titulo}
            className="w-full max-w-sm rounded-2xl border border-line bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-semibold text-ink">{opts.titulo}</h2>
            {opts.mensaje && <p className="mt-1.5 text-sm text-muted">{opts.mensaje}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => cerrar(false)}
                className="rounded-xl border border-line px-3.5 py-2 text-sm font-semibold text-muted transition hover:bg-paper-2 hover:text-ink"
              >
                {opts.cancelar ?? 'Cancelar'}
              </button>
              <button
                onClick={() => cerrar(true)}
                className={`rounded-xl px-3.5 py-2 text-sm font-semibold text-paper transition ${
                  opts.peligro ? 'bg-red-600 hover:bg-red-700' : 'bg-ink hover:opacity-90'
                }`}
              >
                {opts.confirmar ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  )
}
