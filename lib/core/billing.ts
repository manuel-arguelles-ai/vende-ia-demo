import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PLANES, actualizarTenant } from './plataforma'
import { supabaseAdmin } from './db'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PlanPago = 'pro' | 'max'

export type WebhookEvento = {
  id: string
  type?: string
  topic?: string
  dataId: string
}

export type CrearPreapprovalPlanOpts = {
  backUrl?: string
  db?: SupabaseClient
  f?: typeof fetch
}

const MP_BASE = 'https://api.mercadopago.com'

// ─── verificarFirmaMP ─────────────────────────────────────────────────────────

/**
 * Verifica la firma del webhook de MercadoPago (header x-signature "ts=...,v1=...").
 * Manifest: id:<data.id>;request-id:<x-request-id>;ts:<ts>;  HMAC-SHA256 con el secret de la app.
 * Devuelve false ante cualquier anomalía (fail-closed).
 */
export function verificarFirmaMP(input: {
  xSignature: string | null | undefined
  xRequestId: string | null | undefined
  dataId: string | null | undefined
  secret: string | undefined
}): boolean {
  const { xSignature, xRequestId, dataId, secret } = input
  if (!secret || !xSignature || !dataId) return false
  const parts = Object.fromEntries(
    xSignature
      .split(',')
      .map((p) => p.split('=').map((s) => s.trim()))
      .filter((kv) => kv.length === 2),
  ) as { ts?: string; v1?: string }
  if (!parts.ts || !parts.v1) return false
  const manifest = `id:${dataId};request-id:${xRequestId ?? ''};ts:${parts.ts};`
  const esperado = createHmac('sha256', secret).update(manifest).digest('hex')
  try {
    const a = Buffer.from(esperado, 'hex')
    const b = Buffer.from(parts.v1, 'hex')
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// ─── mpFetch ──────────────────────────────────────────────────────────────────

async function mpFetch(
  path: string,
  init: RequestInit = {},
  token: string | undefined = process.env.MP_ACCESS_TOKEN,
  f: typeof fetch = fetch,
): Promise<unknown> {
  const res = await f(`${MP_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
      ...(init.headers ?? {}),
    },
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`MP error ${res.status} ${path}: ${JSON.stringify(json)}`)
  }
  return json
}

// ─── crearPreapprovalPlan ─────────────────────────────────────────────────────

/**
 * Crea un preapproval_plan en MP para el plan dado (Pro o Max).
 * Se ejecuta 1 vez por plan (setup inicial o desde super-admin).
 * Guarda el mp_preapproval_plan_id en billing_config.
 */
export async function crearPreapprovalPlan(
  plan: PlanPago,
  opts: CrearPreapprovalPlanOpts = {},
): Promise<string> {
  const { backUrl = process.env.MP_BACK_URL ?? 'http://localhost:3000/suscripcion/exito', db = supabaseAdmin(), f = fetch } = opts
  const planData = PLANES[plan]

  const body = {
    reason: `${planData.nombre} — vende-ia`,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: planData.precio_pen,
      currency_id: 'PEN',
      free_trial: {
        frequency: 7,
        frequency_type: 'days',
      },
    },
    back_url: backUrl,
  }

  const token = process.env.MP_ACCESS_TOKEN
  const resp = await mpFetch('/preapproval_plan', { method: 'POST', body: JSON.stringify(body) }, token, f) as { id: string }
  const planId = resp.id

  // Guardar en billing_config
  const { error } = await (db
    .from('billing_config')
    .upsert({ plan, mp_preapproval_plan_id: planId, actualizado: new Date().toISOString() }) as unknown as Promise<{ error: { message: string } | null }>)

  if (error) throw new Error(error.message)

  return planId
}

// ─── crearSuscripcion ─────────────────────────────────────────────────────────

/**
 * Crea una suscripción (preapproval) en MP para un tenant dado.
 * Lee el mp_preapproval_plan_id de billing_config.
 * Marca el tenant con sub_estado='trial' y trial_fin=now+7d.
 */
export async function crearSuscripcion(
  tenantId: number,
  plan: PlanPago,
  email: string,
  db: SupabaseClient = supabaseAdmin(),
  f: typeof fetch = fetch,
): Promise<{ init_point: string; preapproval_id: string }> {
  // Leer mp_preapproval_plan_id de billing_config
  const { data: cfg, error: cfgErr } = await db
    .from('billing_config')
    .select('mp_preapproval_plan_id')
    .eq('plan', plan)
    .single()

  if (cfgErr || !cfg) {
    throw new Error(`billing_config no encontrado para plan "${plan}". Crear el preapproval_plan primero.`)
  }

  const preapprovalPlanId = (cfg as { mp_preapproval_plan_id: string }).mp_preapproval_plan_id

  // Obtener el init_point del plan existente (checkout hosteado por MP)
  const token = process.env.MP_ACCESS_TOKEN
  const planResp = await mpFetch(`/preapproval_plan/${preapprovalPlanId}`, {}, token, f) as {
    id: string
    init_point: string
  }

  // Construir URL con external_reference para atribución por tenant
  const separator = planResp.init_point.includes('?') ? '&' : '?'
  const initPoint = `${planResp.init_point}${separator}external_reference=${tenantId}`

  // Calcular trial_fin = now + 7 días
  const trialFin = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  // Marcar tenant como trial (plan se actualiza cuando MP notifica por webhook)
  await db
    .from('tenants')
    .update({
      sub_estado: 'trial',
      trial_fin: trialFin,
      sub_actualizado: now,
    })
    .eq('id', tenantId)

  return { init_point: initPoint, preapproval_id: '' }
}

// ─── procesarWebhook ─────────────────────────────────────────────────────────

/**
 * Procesa un evento webhook de MercadoPago.
 * Idempotente: si el mp_event_id ya existe en facturacion_eventos devuelve {duplicado:true}.
 * Defensivo: no lanza si el tenant no se encuentra; registra el evento y sigue.
 */
export async function procesarWebhook(
  evento: WebhookEvento,
  db: SupabaseClient = supabaseAdmin(),
  f: typeof fetch = fetch,
): Promise<{ duplicado?: boolean }> {
  const { id: eventId, type, topic, dataId } = evento
  const tipo = type ?? topic ?? 'unknown'
  const token = process.env.MP_ACCESS_TOKEN

  // 1. Idempotencia: chequear si ya procesamos este evento
  const { data: existing } = await db
    .from('facturacion_eventos')
    .select('id')
    .eq('mp_event_id', eventId)
    .maybeSingle()

  if (existing) return { duplicado: true }

  let tenantId: number | null = null
  let payload: unknown = null

  // 2. Procesar según tipo
  if (tipo === 'subscription_preapproval') {
    const preapproval = await mpFetch(`/preapproval/${dataId}`, {}, token, f) as {
      id: string
      status: string
      external_reference?: string
      payer_email?: string
      preapproval_plan_id?: string
    }
    payload = preapproval

    // Resolver tenantId:
    // 1) Primero por mp_preapproval_id (el id del preapproval del evento guardado en tenants)
    const { data: tenantByPreapproval } = await db
      .from('tenants')
      .select('id')
      .eq('mp_preapproval_id', preapproval.id)
      .maybeSingle()
    if (tenantByPreapproval) {
      tenantId = (tenantByPreapproval as { id: number }).id
    }

    // 2) Fallback: external_reference numérico (alta inicial, cuando aún no hay mp_preapproval_id guardado)
    if (tenantId === null) {
      const extRef = preapproval.external_reference
      if (extRef) {
        const tenantNumId = parseInt(extRef, 10)
        if (!isNaN(tenantNumId)) {
          tenantId = tenantNumId
        }
      }
    }

    // 3) Último fallback: payer_email en usuarios
    if (tenantId === null && preapproval.payer_email) {
      const { data: usuario } = await db
        .from('usuarios')
        .select('tenant_id')
        .eq('email', preapproval.payer_email)
        .maybeSingle()
      if (usuario) {
        tenantId = (usuario as { tenant_id: number }).tenant_id
      }
    }

    if (tenantId !== null) {
      const now = new Date().toISOString()

      if (preapproval.status === 'authorized') {
        // Activar tenant
        await db.from('tenants').update({ estado: 'activo', sub_estado: 'authorized', sub_actualizado: now }).eq('id', tenantId)
      } else if (preapproval.status === 'paused') {
        await db.from('tenants').update({ sub_estado: 'paused', sub_actualizado: now }).eq('id', tenantId)
      } else if (preapproval.status === 'cancelled') {
        await db.from('tenants').update({ sub_estado: 'cancelled', sub_actualizado: now }).eq('id', tenantId)
      }
    }
  } else if (tipo === 'subscription_authorized_payment') {
    const payment = await mpFetch(`/authorized_payments/${dataId}`, {}, token, f) as {
      id: string
      status: string
      external_reference?: string
      preapproval_id?: string
    }
    payload = payment

    // Para payments, buscamos por preapproval_id en tenants
    if (payment.preapproval_id) {
      const { data: tenantRow } = await db
        .from('tenants')
        .select('id')
        .eq('mp_preapproval_id', payment.preapproval_id)
        .maybeSingle()

      if (tenantRow) {
        const row = tenantRow as { id: number }
        tenantId = row.id
        const now = new Date().toISOString()

        if (payment.status === 'rejected') {
          await db.from('tenants').update({ sub_estado: 'paused', sub_actualizado: now }).eq('id', tenantId)
        }
        // 'approved' → mantiene estado actual, no se modifica
      }
    }
  }

  // 3. Registrar el evento en facturacion_eventos
  await db.from('facturacion_eventos').insert({
    mp_event_id: eventId,
    tenant_id: tenantId ?? 1,
    tipo,
    payload,
  })

  return {}
}

// ─── cancelarSuscripcion ─────────────────────────────────────────────────────

/**
 * Cancela la suscripción activa del tenant en MP y la marca en BD.
 */
export async function cancelarSuscripcion(
  tenantId: number,
  db: SupabaseClient = supabaseAdmin(),
  f: typeof fetch = fetch,
): Promise<void> {
  // Obtener mp_preapproval_id del tenant
  const { data: tenantRow } = await db
    .from('tenants')
    .select('mp_preapproval_id')
    .eq('id', tenantId)
    .maybeSingle()

  if (!tenantRow) throw new Error(`Tenant ${tenantId} no encontrado`)

  const { mp_preapproval_id } = tenantRow as { mp_preapproval_id: string }
  if (!mp_preapproval_id) throw new Error(`Tenant ${tenantId} no tiene suscripción activa`)

  const token = process.env.MP_ACCESS_TOKEN
  await mpFetch(`/preapproval/${mp_preapproval_id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
  }, token, f)

  const now = new Date().toISOString()
  await db.from('tenants').update({ sub_estado: 'cancelled', sub_actualizado: now }).eq('id', tenantId)
}

// ─── aplicarDunning ───────────────────────────────────────────────────────────

/**
 * Busca tenants con sub_estado='paused' cuya última actualización
 * es anterior a now - graciaDias y los suspende.
 * Devuelve el número de tenants suspendidos.
 */
export async function aplicarDunning(
  graciaDias: number = 3,
  db: SupabaseClient = supabaseAdmin(),
): Promise<number> {
  const umbral = new Date(Date.now() - graciaDias * 24 * 60 * 60 * 1000).toISOString()

  const { data: tenants } = await db
    .from('tenants')
    .select('id')
    .eq('sub_estado', 'paused')
    .lt('sub_actualizado', umbral)

  if (!tenants || tenants.length === 0) return 0

  const rows = tenants as { id: number }[]
  await Promise.all(rows.map(t => actualizarTenant(t.id, { estado: 'suspendido' }, db)))

  return rows.length
}
