import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/core/autorizacion'
import { asignarLead } from '@/lib/core/asignacion'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const g = await requireAdmin()
  if ('error' in g) return g.error
  const b = (await req.json().catch(() => ({}))) as { remitente?: string; usuarioId?: number | null }
  if (!b.remitente) return NextResponse.json({ error: 'remitente requerido' }, { status: 400 })
  const usuarioId = b.usuarioId === undefined ? null : b.usuarioId
  try {
    await asignarLead(b.remitente, usuarioId, g.sesion.tenantId)
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('USUARIO_FUERA_DE_TENANT')) {
      return NextResponse.json({ error: 'asesor inválido' }, { status: 400 })
    }
    throw err
  }
  return NextResponse.json({ ok: true })
}
