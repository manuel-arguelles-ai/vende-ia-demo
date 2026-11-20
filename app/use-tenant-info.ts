'use client'
import { useEffect, useState } from 'react'
import { conBase } from '@/lib/base'

export type TenantInfo = {
  nombre: string | null
  nombreBot: string | null
  email: string | null
  usuarioNombre?: string | null
  plan?: string
  rol?: string
  permisos?: import('@/lib/core/permisos').PermisosAsesor | null
}

let cache: Promise<TenantInfo | null> | null = null
function cargar(): Promise<TenantInfo | null> {
  if (!cache) {
    cache = fetch(conBase('/api/mi-plan'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  }
  return cache
}

export function useTenantInfo(): TenantInfo | null {
  const [info, setInfo] = useState<TenantInfo | null>(null)
  useEffect(() => {
    cargar().then(setInfo)
  }, [])
  return info
}
