import { NextResponse } from 'next/server'
import { listarContactos, guardarContacto, eliminarContacto } from '@/lib/core/contactos'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { remitentesVisibles, puedeVerRemitente } from '@/lib/core/visibilidad'
import { asesorPuedeEditar } from '@/lib/core/autorizacion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Vista Contactos + edición manual de la ficha.
export async function GET() {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })

  const visibles = await remitentesVisibles(sesion)
  if (visibles !== null && visibles.length === 0) return NextResponse.json([])

  const todos = await listarContactos(sesion.tenantId)
  const resultado = visibles !== null ? todos.filter((c) => visibles.includes(c.remitente)) : todos
  return NextResponse.json(resultado)
}

export async function PATCH(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })

  const { remitente, nombre, ciudad } = (await req.json().catch(() => ({}))) as {
    remitente?: string
    nombre?: string
    ciudad?: string
  }
  if (!remitente) return NextResponse.json({ error: 'remitente requerido' }, { status: 400 })
  if (!(await puedeVerRemitente(sesion, remitente))) {
    return NextResponse.json({ error: 'sin acceso a este lead' }, { status: 403 })
  }
  if (!(await asesorPuedeEditar(sesion, 'contactos'))) {
    return NextResponse.json({ error: 'sin permiso de edición' }, { status: 403 })
  }
  await guardarContacto(remitente, { nombre: nombre ?? null, ciudad: ciudad ?? null }, sesion.tenantId)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })

  const { remitente } = (await req.json().catch(() => ({}))) as { remitente?: string }
  if (!remitente) return NextResponse.json({ error: 'remitente requerido' }, { status: 400 })
  if (!(await puedeVerRemitente(sesion, remitente))) {
    return NextResponse.json({ error: 'sin acceso a este lead' }, { status: 403 })
  }
  if (!(await asesorPuedeEditar(sesion, 'contactos'))) {
    return NextResponse.json({ error: 'sin permiso de edición' }, { status: 403 })
  }
  await eliminarContacto(remitente, sesion.tenantId)
  return NextResponse.json({ ok: true })
}
