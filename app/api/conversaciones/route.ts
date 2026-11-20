import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/db'
import { scoped } from '@/lib/core/tenant'
import { agruparConversaciones, type MensajeRow, type PedidoLite } from '@/lib/core/conversaciones'
import { remitentesPausados } from '@/lib/core/control'
import { etiquetasPorRemitente } from '@/lib/core/etiquetas'
import { contactosPorRemitente } from '@/lib/core/contactos'
import { cierresPorRemitente, recordatoriosPendientes } from '@/lib/core/gestion'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { remitentesVisibles } from '@/lib/core/visibilidad'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  const { tenantId } = sesion

  const visibles = await remitentesVisibles(sesion)
  if (visibles !== null && visibles.length === 0) return NextResponse.json([])

  const db = supabaseAdmin()
  const s = scoped(db, tenantId)

  // Para el asesor, filtrar por sus remitentes EN la query (no después del limit),
  // así el corte global de 400/200 no deja fuera sus conversaciones.
  const msgsQ = s.from('mensajes').select('remitente,rol,texto,etapa,created_at,imagen_url').order('created_at', { ascending: false }).limit(400)
  const pedsQ = s.from('pedidos').select('remitente,temperatura,score,derivar,producto,estado,extra,created_at').order('created_at', { ascending: false }).limit(200)

  const [msgs, peds, pausados, etiquetas, contactos, cierres, pendientes] = await Promise.all([
    visibles !== null ? msgsQ.in('remitente', visibles) : msgsQ,
    visibles !== null ? pedsQ.in('remitente', visibles) : pedsQ,
    remitentesPausados(tenantId, db),
    etiquetasPorRemitente(tenantId, db),
    contactosPorRemitente(tenantId, db),
    cierresPorRemitente(tenantId, db),
    recordatoriosPendientes(tenantId, db),
  ])
  // próximo recordatorio pendiente por remitente
  const recordatorios = new Map<string, string>()
  for (const r of pendientes) if (!recordatorios.has(r.remitente)) recordatorios.set(r.remitente, r.cuando)
  if (msgs.error) return NextResponse.json({ error: msgs.error.message }, { status: 500 })
  let convs = agruparConversaciones(
    (msgs.data ?? []) as MensajeRow[],
    (peds.data ?? []) as PedidoLite[],
    pausados,
    etiquetas,
    contactos,
    cierres,
    recordatorios,
  )
  if (visibles !== null) convs = convs.filter((c) => visibles.includes(c.remitente))
  return NextResponse.json(convs)
}
