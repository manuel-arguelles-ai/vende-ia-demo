import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './db'

// Bitácora de eventos de plataforma (altas, conexiones de WhatsApp, etc.).
// Solo service_role: la tabla tiene RLS sin políticas (ver supabase/plataforma-eventos.sql).

export type PlataformaEvento = {
  id: number
  tenant_id: number | null
  tipo: string
  detalle: Record<string, unknown>
  created_at: string
}

/**
 * Registra un evento de plataforma. Best-effort / fail-open: un fallo al
 * loguear NUNCA debe romper el flujo que lo dispara (alta, conexión, etc.).
 */
export async function registrarEvento(
  tipo: string,
  tenantId: number | null,
  detalle: Record<string, unknown> = {},
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  try {
    const { error } = await db.from('plataforma_eventos').insert({ tipo, tenant_id: tenantId, detalle })
    // fail-open: nunca propagar, pero avisar para diagnóstico (p.ej. DDL no aplicado).
    if (error) console.warn('[eventos] no se pudo registrar', tipo, '-', error.message)
  } catch (e) {
    console.warn('[eventos] excepción al registrar', tipo, '-', e instanceof Error ? e.message : e)
  }
}

/** Últimos eventos para el feed del super-admin (orden desc por fecha). */
export async function eventosRecientes(
  limit = 20,
  db: SupabaseClient = supabaseAdmin(),
): Promise<PlataformaEvento[]> {
  const { data, error } = await db
    .from('plataforma_eventos')
    .select('id,tenant_id,tipo,detalle,created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data as PlataformaEvento[]
}
