import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/core/autorizacion'
import { obtenerTenantPlan, planTieneWhatsapp } from '@/lib/core/plataforma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Proxy autenticado al worker: estado de conexión de WhatsApp + QR para vincular.
// SOLO admin: WhatsApp es un recurso del tenant; un asesor no debe conectar/desvincular.
// Además es exclusivo de planes pagos (pro+): un tenant free NO toca el worker
// (no se crea sesión Baileys) y recibe disponible:false para mostrar el CTA de upgrade.
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { sesion } = auth

  // Gate por plan: el canal WhatsApp solo para pro/max/enterprise.
  const { plan } = await obtenerTenantPlan(sesion.tenantId)
  if (!planTieneWhatsapp(plan)) {
    return NextResponse.json({ connected: false, qr: null, disponible: false, motivo: 'plan' })
  }

  const url = process.env.WORKER_URL
  const token = process.env.WORKER_TOKEN
  if (!url) {
    return NextResponse.json({ connected: false, qr: null, error: 'worker no configurado', disponible: true }, { status: 503 })
  }
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/qr?tenant=${sesion.tenantId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    })
    if (!r.ok) {
      return NextResponse.json({ connected: false, qr: null, error: `worker ${r.status}`, disponible: true }, { status: 502 })
    }
    const data = (await r.json()) as { connected?: boolean; qr?: string | null }
    return NextResponse.json({ connected: !!data.connected, qr: data.qr ?? null, disponible: true })
  } catch {
    return NextResponse.json({ connected: false, qr: null, error: 'worker no responde', disponible: true }, { status: 502 })
  }
}
