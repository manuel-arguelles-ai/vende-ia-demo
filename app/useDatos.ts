'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Conversacion } from '@/lib/core/conversaciones'
import type { PedidoGuardado } from '@/lib/core/schemas'
import { conBase } from '@/lib/base'

// Cliente browser (anon key, solo lectura por RLS). Singleton del módulo.
let sb: SupabaseClient | null = null
function browserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  if (!sb) sb = createClient(url, key, { auth: { persistSession: false } })
  return sb
}

// Datos del CRM con realtime: cada INSERT en pedidos dispara un refetch de las
// dos APIs. Fallback: polling lento si la suscripción está viva, rápido si no.
export function useDatos() {
  const [convs, setConvs] = useState<Conversacion[]>([])
  const [pedidos, setPedidos] = useState<PedidoGuardado[]>([])
  const [vivo, setVivo] = useState(false)
  const vivoRef = useRef(false)

  const refetch = useCallback(async () => {
    try {
      const [rc, rp] = await Promise.all([
        fetch(conBase('/api/conversaciones'), { cache: 'no-store' }),
        fetch(conBase('/api/pedidos'), { cache: 'no-store' }),
      ])
      if (rc.ok) setConvs(await rc.json())
      if (rp.ok) setPedidos(await rp.json())
    } catch {
      /* siguiente tick lo reintenta */
    }
  }, [])

  useEffect(() => {
    const inicial = setTimeout(refetch, 0) // carga inicial diferida (evita setState síncrono en el effect)
    const cliente = browserClient()

    let canal: ReturnType<NonNullable<typeof cliente>['channel']> | undefined

    // Intentar obtener JWT con tenant_id para que RLS filtre en Realtime.
    // Si falla (sin sesión, sin secret configurado), no suscribir — el polling fallback cubre.
    fetch(conBase('/api/realtime-token'))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(({ token }: { token: string }) => {
        if (!cliente) return
        // Autenticar el canal con el JWT antes de suscribir
        cliente.realtime.setAuth(token)
        canal = cliente
          .channel('crm-live')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, () => refetch())
          // mensajes también: en takeover (bot pausado) los turnos no insertan pedidos
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, () => refetch())
          .subscribe((status) => {
            const ok = status === 'SUBSCRIBED'
            vivoRef.current = ok
            setVivo(ok)
          })
      })
      .catch(() => {
        // Sin token: no suscribirse. El polling de 4 s (vivo=false) cubre la actualización.
      })

    const id = setInterval(() => refetch(), vivoRef.current ? 20000 : 4000)
    return () => {
      clearTimeout(inicial)
      clearInterval(id)
      if (canal) cliente?.removeChannel(canal)
    }
  }, [refetch])

  return { convs, pedidos, vivo, refetch }
}

// "hace cuánto" compacto para tarjetas: ahora / 5 min / 2 h / 3 d
export function haceCuanto(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h`
  return `${Math.floor(h / 24)} d`
}

// Un caliente sin atención hace >15 min se está enfriando: pide acción.
export function estancado(c: Conversacion): boolean {
  return c.temperatura === 'caliente' && Date.now() - new Date(c.ultimoAt).getTime() > 15 * 60000
}
