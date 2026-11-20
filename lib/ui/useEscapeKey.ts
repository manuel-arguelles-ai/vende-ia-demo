'use client'
import { useEffect } from 'react'

// Cierra modales con la tecla Escape. Solo escucha cuando `activo` es true.
export function useEscapeKey(activo: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!activo) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activo, onEscape])
}
