import { NextResponse } from 'next/server'
import { agregarEtiqueta, quitarEtiqueta } from '@/lib/core/etiquetas'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { puedeVerRemitente } from '@/lib/core/visibilidad'
import { asesorPuedeEditar } from '@/lib/core/autorizacion'

export const runtime = 'nodejs'

// Gestión de etiquetas manuales desde el CRM. Protegida por el middleware.
export async function POST(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })

  const { remitente, etiqueta, accion } = (await req.json().catch(() => ({}))) as {
    remitente?: string
    etiqueta?: string
    accion?: 'agregar' | 'quitar'
  }
  if (!remitente || !etiqueta?.trim()) {
    return NextResponse.json({ error: 'remitente y etiqueta requeridos' }, { status: 400 })
  }
  if (!(await puedeVerRemitente(sesion, remitente))) {
    return NextResponse.json({ error: 'sin acceso a este lead' }, { status: 403 })
  }
  if (!(await asesorPuedeEditar(sesion, 'pipeline'))) {
    return NextResponse.json({ error: 'sin permiso de edición' }, { status: 403 })
  }
  if (accion === 'quitar') await quitarEtiqueta(remitente, etiqueta, sesion.tenantId)
  else await agregarEtiqueta(remitente, etiqueta, 'manual', sesion.tenantId)
  return NextResponse.json({ ok: true })
}
