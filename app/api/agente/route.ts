import { NextResponse } from 'next/server'
import { obtenerPerfil, guardarPerfil, type AgentePerfil } from '@/lib/core/perfil'
import { tenantDeSesion } from '@/lib/core/sesion-helper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ENUMS: Record<string, readonly string[]> = {
  tono: ['cercano', 'neutral', 'formal'],
  longitud: ['cortas', 'medias'],
  intensidadCierre: ['informativo', 'equilibrado', 'cerrador'],
  agresividad: ['suave', 'media', 'alta'],
}
const TEXTOS: (keyof AgentePerfil)[] = [
  'nombreBot', 'instruccionesExtra', 'negocioNombre', 'rubro', 'categorias',
  'saludoInicial', 'mensajeNoSe', 'temasProhibidos',
]
const MAX = 2000

export async function GET() {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  return NextResponse.json(await obtenerPerfil(sesion.tenantId))
}

export async function PUT(req: Request) {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'objeto requerido' }, { status: 400 })
  }
  const perfil: Partial<AgentePerfil> = {}
  for (const [k, dominio] of Object.entries(ENUMS)) {
    if (body[k] !== undefined) {
      if (typeof body[k] !== 'string' || !dominio.includes(body[k] as string)) {
        return NextResponse.json({ error: `valor inválido para ${k}` }, { status: 400 })
      }
      ;(perfil as Record<string, unknown>)[k] = body[k]
    }
  }
  if (body.emojis !== undefined) {
    if (typeof body.emojis !== 'boolean') return NextResponse.json({ error: 'emojis inválido' }, { status: 400 })
    perfil.emojis = body.emojis
  }
  for (const k of TEXTOS) {
    if (body[k] !== undefined) {
      if (body[k] !== null && (typeof body[k] !== 'string' || (body[k] as string).length > MAX)) {
        return NextResponse.json({ error: `valor inválido para ${k}` }, { status: 400 })
      }
      ;(perfil as Record<string, unknown>)[k] = body[k]
    }
  }
  await guardarPerfil(perfil, sesion.tenantId)
  return NextResponse.json({ ok: true })
}
