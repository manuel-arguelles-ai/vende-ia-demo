import { NextResponse } from 'next/server'
import { guardarMensaje } from '@/lib/core/historial'
import { setBotPausado } from '@/lib/core/control'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { puedeVerRemitente } from '@/lib/core/visibilidad'
import { asesorPuedeEditar } from '@/lib/core/autorizacion'
import { obtenerNegocio } from '@/lib/core/negocio'
import { detectarPagoNoAutorizado } from '@/lib/core/antifraude-pago'
import { registrarAlertaFraude } from '@/lib/core/alertas'
import { supabaseAdmin } from '@/lib/core/db'
import { scoped } from '@/lib/core/tenant'

export const runtime = 'nodejs'

// El asesor responde desde el CRM (takeover). Protegida por el middleware de sesión.
// - Leads de WhatsApp (remitente con @): el envío lo hace el worker de Railway
//   (que tiene la sesión de Baileys) vía POST /enviar con token compartido.
// - Leads del simulador: solo se registra el mensaje (no hay adónde enviarlo).
// En ambos casos se pausa el bot: si el humano habló, Nina se calla.
export async function POST(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  const { remitente, texto } = (await req.json().catch(() => ({}))) as {
    remitente?: string
    texto?: string
  }
  if (!remitente || typeof remitente !== 'string' || !texto || !texto.trim()) {
    return NextResponse.json({ error: 'remitente y texto requeridos' }, { status: 400 })
  }
  if (!(await puedeVerRemitente(sesion, remitente))) {
    return NextResponse.json({ error: 'sin acceso a este lead' }, { status: 403 })
  }
  if (!(await asesorPuedeEditar(sesion, 'pipeline'))) {
    return NextResponse.json({ error: 'sin permiso de edición' }, { status: 403 })
  }

  // Antifraude: bloquear formas de pago no configuradas (override solo admin), alertar siempre.
  const negocio = await obtenerNegocio(sesion.tenantId)
  const fraude = detectarPagoNoAutorizado(texto, negocio)
  if (fraude.fraude) {
    // Teléfono real del lead (el remitente puede ser un LID): vive en extra._tel del último pedido.
    const { data: prevPed } = await scoped(supabaseAdmin(), sesion.tenantId)
      .from('pedidos').select('extra').eq('remitente', remitente)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    const tel = ((prevPed?.extra as Record<string, unknown> | undefined)?._tel as string | undefined) ?? null
    await registrarAlertaFraude({ tenantId: sesion.tenantId, remitente, autor: 'asesor', texto: texto.trim(), numero: fraude.numero, telefono: tel })
    if (sesion.rol !== 'admin') {
      return NextResponse.json({ error: 'forma_pago_no_autorizada', numero: fraude.numero }, { status: 403 })
    }
  }

  const esWhatsapp = remitente.includes('@')
  if (esWhatsapp) {
    const url = process.env.WORKER_URL
    const token = process.env.WORKER_TOKEN
    if (!url || !token) {
      return NextResponse.json({ error: 'falta configurar WORKER_URL/WORKER_TOKEN' }, { status: 500 })
    }
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/enviar?tenant=${sesion.tenantId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ remitente, texto: texto.trim() }),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) {
        const detalle = await res.text().catch(() => '')
        return NextResponse.json(
          { error: `el worker no pudo enviar (${res.status}) ${detalle.slice(0, 120)}` },
          { status: 502 },
        )
      }
    } catch {
      return NextResponse.json({ error: 'no se pudo contactar al worker de WhatsApp' }, { status: 502 })
    }
  } else {
    // Simulador: el "envío" es solo persistir el turno del asesor.
    await guardarMensaje(remitente, 'asesor', texto.trim(), null, sesion.tenantId)
  }

  await setBotPausado(remitente, true, sesion.tenantId)
  return NextResponse.json({ ok: true })
}
