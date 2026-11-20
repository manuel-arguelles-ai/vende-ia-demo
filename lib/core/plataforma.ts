import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './db'
import { consumoDelMes, estadoLimiteMensajes } from './limites'

// ─── Planes ──────────────────────────────────────────────────────────────────

export const PLANES = {
  free:       { nombre: 'Free',       precio_pen: 0,   pago: false, limites: { mensajes_mes: 1000,   asesores: 1,  voz: false, vision: false, whatsapp: false } },
  pro:        { nombre: 'Pro',        precio_pen: 199, pago: true,  limites: { mensajes_mes: 20000,  asesores: 3,  voz: true,  vision: true,  whatsapp: true  } },
  max:        { nombre: 'Max',        precio_pen: 599, pago: true,  limites: { mensajes_mes: 100000, asesores: 10, voz: true,  vision: true,  whatsapp: true  } },
  enterprise: { nombre: 'Enterprise', precio_pen: 0,   pago: false, contacto: true, limites: { mensajes_mes: 0, asesores: 0, voz: true, vision: true, whatsapp: true } },
} as const

export type PlanKey = keyof typeof PLANES

// El canal WhatsApp es exclusivo de planes pagos (pro+); free usa solo el widget web.
// Plan desconocido → false (fail-closed). Espejo de planTieneVision (vision.ts).
export function planTieneWhatsapp(plan: string): boolean {
  const p = (PLANES as Record<string, { limites: { whatsapp?: boolean } }>)[plan]
  return p?.limites?.whatsapp ?? false
}

// La transcripción de voz (STT) es de planes pagos; free no la usa (evita gasto Groq).
// Plan desconocido → false (fail-closed). Espejo de planTieneVision.
export function planTieneVoz(plan: string): boolean {
  const p = (PLANES as Record<string, { limites: { voz?: boolean } }>)[plan]
  return p?.limites?.voz ?? false
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type TenantMetricas = {
  id: number
  nombre: string
  slug: string
  estado: string
  plan: string
  created_at: string
  usuarios: number
  mensajes: number
  pedidos: number
  productos: number
  ultima_actividad: string | null
  consumoMes: { mensajes: number; tokens_llm: number; segundos_voz: number }
  limiteExcedido: boolean
  cierres: number
  conversion: number
  canal: 'conectado' | 'desconectado' | 'desconocido'
  ventana_turnos: number | null
}

// ─── metricasTenants ─────────────────────────────────────────────────────────

export async function metricasTenants(
  db: SupabaseClient = supabaseAdmin(),
  salud?: { porTenant: Map<number, boolean>; workerCaido: boolean },
): Promise<TenantMetricas[]> {
  // Traer todos los tenants ordenados por id
  const { data: tenants, error: tenantsError } = await db
    .from('tenants')
    .select('id,nombre,slug,estado,plan,created_at,ventana_turnos')
    .order('id')

  if (tenantsError) throw new Error(tenantsError.message)
  if (!tenants || tenants.length === 0) return []

  const resultado: TenantMetricas[] = []

  for (const tenant of tenants as { id: number; nombre: string; slug: string; estado: string; plan: string; created_at: string; ventana_turnos: number | null }[]) {
    // Counts por tabla filtrando por tenant_id
    const [
      { count: usuarios },
      { count: mensajes },
      { count: pedidos },
      { count: productos },
      { count: cierres },
    ] = await Promise.all([
      db.from('usuarios').select('tenant_id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
      db.from('mensajes').select('tenant_id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
      db.from('pedidos').select('tenant_id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
      db.from('productos').select('tenant_id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
      db.from('cierres').select('tenant_id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
    ])

    // Última actividad = max(created_at) de mensajes del tenant
    const { data: mensajesRows } = await db
      .from('mensajes')
      .select('created_at')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(1)

    const ultima_actividad =
      mensajesRows && mensajesRows.length > 0
        ? (mensajesRows[0] as { created_at: string }).created_at
        : null

    const [consumoMes, estadoLimite] = await Promise.all([
      consumoDelMes(tenant.id, db),
      estadoLimiteMensajes(tenant.id, tenant.plan, null, db),
    ])

    const cierresNum = cierres ?? 0
    const pedidosNum = pedidos ?? 0
    const conversion = pedidosNum ? cierresNum / pedidosNum : 0
    let canal: TenantMetricas['canal'] = 'desconocido'
    if (salud && salud.porTenant.has(tenant.id)) {
      canal = salud.porTenant.get(tenant.id) ? 'conectado' : 'desconectado'
    }

    resultado.push({
      id: tenant.id,
      nombre: tenant.nombre,
      slug: tenant.slug,
      estado: tenant.estado,
      plan: tenant.plan,
      created_at: tenant.created_at,
      usuarios: usuarios ?? 0,
      mensajes: mensajes ?? 0,
      pedidos: pedidosNum,
      productos: productos ?? 0,
      ultima_actividad,
      consumoMes,
      limiteExcedido: estadoLimite.excedido,
      cierres: cierresNum,
      conversion,
      canal,
      ventana_turnos: tenant.ventana_turnos,
    })
  }

  return resultado
}

// ─── actualizarTenant ─────────────────────────────────────────────────────────

const ESTADOS_VALIDOS = new Set(['activo', 'suspendido'])

// Ventana de turnos textuales del bot: default y límites de seguridad.
export const VENTANA_TURNOS_DEFAULT = 20
export const VENTANA_TURNOS_MIN = 6
export const VENTANA_TURNOS_MAX = 60

export async function actualizarTenant(
  id: number,
  campos: { estado?: string; plan?: string; ventana_turnos?: number | null },
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  // Validar estado si viene
  if (campos.estado !== undefined && !ESTADOS_VALIDOS.has(campos.estado)) {
    throw new Error(`estado inválido: "${campos.estado}". Debe ser 'activo' o 'suspendido'.`)
  }

  // Armar objeto solo con campos permitidos presentes
  const obj: Record<string, string | number | null> = {}
  if (campos.estado !== undefined) obj.estado = campos.estado
  if (campos.plan !== undefined) obj.plan = campos.plan
  if (campos.ventana_turnos !== undefined) {
    // null = volver al default; si viene número, clamp a [MIN, MAX]
    obj.ventana_turnos = campos.ventana_turnos === null
      ? null
      : Math.max(VENTANA_TURNOS_MIN, Math.min(VENTANA_TURNOS_MAX, Math.round(campos.ventana_turnos)))
  }

  if (Object.keys(obj).length === 0) {
    throw new Error('sin cambios: no se proporcionaron campos válidos.')
  }

  const { error } = await db.from('tenants').update(obj).eq('id', id)
  if (error) throw new Error(error.message)
}

// Ventana de turnos efectiva del tenant (config o default). Fail-safe al default.
export async function obtenerVentanaTurnos(
  tenantId: number,
  db: SupabaseClient = supabaseAdmin(),
): Promise<number> {
  const { data, error } = await db.from('tenants').select('ventana_turnos').eq('id', tenantId).maybeSingle()
  if (error || !data) return VENTANA_TURNOS_DEFAULT
  const v = (data as { ventana_turnos: number | null }).ventana_turnos
  if (v == null) return VENTANA_TURNOS_DEFAULT
  return Math.max(VENTANA_TURNOS_MIN, Math.min(VENTANA_TURNOS_MAX, v))
}

// ─── obtenerTenantPlan ────────────────────────────────────────────────────────

export async function obtenerTenantPlan(
  tenantId: number,
  db: SupabaseClient = supabaseAdmin(),
): Promise<{ plan: string; sub_estado: string | null }> {
  const { data, error } = await db
    .from('tenants')
    .select('plan,sub_estado')
    .eq('id', tenantId)
    .maybeSingle()

  if (error || !data) return { plan: 'free', sub_estado: null }
  const row = data as { plan: string | null; sub_estado: string | null }
  return { plan: row.plan ?? 'free', sub_estado: row.sub_estado ?? null }
}

// ─── tenantActivo ─────────────────────────────────────────────────────────────

export async function tenantActivo(
  tenantId: number,
  db: SupabaseClient = supabaseAdmin(),
): Promise<boolean> {
  const { data, error } = await db
    .from('tenants')
    .select('estado')
    .eq('id', tenantId)
    .maybeSingle()

  // Fail-open: si hay error o no hay fila, no bloqueamos
  if (error || !data) return true

  return (data as { estado: string }).estado !== 'suspendido'
}
