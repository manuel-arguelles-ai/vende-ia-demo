'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { calcularNuevos } from '@/lib/ui/vistos'

// Rastrea qué leads (remitentes) ya abrió el usuario, en localStorage (clave por
// usuario). Primer uso: siembra con los leads actuales → nada aparece "nuevo" el
// primer día; solo los que lleguen después. Espera a tener datos para sembrar.
export function useVistos(remitentes: string[], claveUsuario: string | null) {
  const key = claveUsuario ? `vende-ia:vistos:${claveUsuario}` : null
  const [vistos, setVistos] = useState<string[] | null>(null)
  const sembrado = useRef(false)

  useEffect(() => {
    if (!key || sembrado.current) return
    try {
      const raw = localStorage.getItem(key)
      if (raw !== null) {
        setVistos(JSON.parse(raw) as string[])
        sembrado.current = true
        return
      }
      // Aún no sembrado: esperar a tener leads para no marcar todo como nuevo.
      if (remitentes.length === 0) return
      localStorage.setItem(key, JSON.stringify(remitentes))
      setVistos(remitentes)
      sembrado.current = true
    } catch {
      setVistos([])
      sembrado.current = true
    }
  }, [key, remitentes])

  const marcarVisto = useCallback(
    (rem: string) => {
      setVistos((prev) => {
        if (prev && prev.includes(rem)) return prev
        const next = prev ? [...prev, rem] : [rem]
        if (key) {
          try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
        }
        return next
      })
    },
    [key],
  )

  const esNuevo = useCallback((rem: string) => vistos !== null && !vistos.includes(rem), [vistos])
  const nuevos = calcularNuevos(vistos, remitentes)

  return { esNuevo, marcarVisto, nuevos }
}
