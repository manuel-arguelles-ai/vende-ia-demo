import { PLANES, type TenantMetricas } from './plataforma'

export async function saludCanales(
  fetchFn: typeof fetch = fetch,
): Promise<{ porTenant: Map<number, boolean>; workerCaido: boolean }> {
  const url = process.env.WORKER_URL
  const token = process.env.WORKER_TOKEN
  const porTenant = new Map<number, boolean>()
  // Sin WORKER_URL configurado no hay worker que consultar → caído (best-effort).
  if (!url) return { porTenant, workerCaido: true }
  try {
    const r = await fetchFn(`${url.replace(/\/$/, '')}/salud`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!r.ok) return { porTenant, workerCaido: true }
    const data = (await r.json()) as { sesiones?: { tenantId: number; connected: boolean }[] }
    for (const s of data.sesiones ?? []) porTenant.set(s.tenantId, s.connected)
    return { porTenant, workerCaido: false }
  } catch {
    return { porTenant, workerCaido: true }
  }
}

export type ResumenPlataforma = {
  tenants_total: number
  tenants_activos: number
  tenants_suspendidos: number
  por_plan: Record<string, number>
  mensajes_mes_total: number
  tokens_mes_total: number
  voz_mes_total: number
  limite_excedido_total: number
  pedidos_total: number
  cierres_total: number
  wa_conectados: number
  wa_total: number
  worker_caido: boolean
  ingreso_potencial_pen: number
}

export function resumenPlataforma(
  tenants: TenantMetricas[],
  salud: { porTenant: Map<number, boolean>; workerCaido: boolean },
): ResumenPlataforma {
  const por_plan: Record<string, number> = {}
  let activos = 0,
    suspendidos = 0,
    mensajes = 0,
    tokens = 0,
    voz = 0,
    excedidos = 0,
    pedidos = 0,
    cierres = 0,
    ingreso = 0

  for (const t of tenants) {
    por_plan[t.plan] = (por_plan[t.plan] ?? 0) + 1
    if (t.estado === 'activo') activos++
    else if (t.estado === 'suspendido') suspendidos++
    mensajes += t.consumoMes?.mensajes ?? 0
    tokens += t.consumoMes?.tokens_llm ?? 0
    voz += t.consumoMes?.segundos_voz ?? 0
    if (t.limiteExcedido) excedidos++
    pedidos += t.pedidos ?? 0
    cierres += t.cierres ?? 0
    if (t.estado === 'activo') {
      const p = (PLANES as Record<string, { precio_pen: number; pago: boolean }>)[t.plan]
      if (p?.pago) ingreso += p.precio_pen
    }
  }

  let conectados = 0
  for (const v of salud.porTenant.values()) if (v) conectados++

  return {
    tenants_total: tenants.length,
    tenants_activos: activos,
    tenants_suspendidos: suspendidos,
    por_plan,
    mensajes_mes_total: mensajes,
    tokens_mes_total: tokens,
    voz_mes_total: voz,
    limite_excedido_total: excedidos,
    pedidos_total: pedidos,
    cierres_total: cierres,
    wa_conectados: conectados,
    wa_total: salud.porTenant.size,
    worker_caido: salud.workerCaido,
    ingreso_potencial_pen: ingreso,
  }
}
