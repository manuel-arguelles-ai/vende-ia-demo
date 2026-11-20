import { NextResponse } from 'next/server'
import { resolverTenantPorWidgetKey } from '@/lib/core/tenant'
import { atender } from '@/lib/core/atender'

export const runtime = 'nodejs'

// Rate-limit simple por (widget_key + IP): máximo 20 req/minuto por clave.
// Se usa una Map en memoria (por instancia); suficiente para la fase inicial.
const VENTANA_MS = 60_000
const MAX_REQ_VENTANA = 20

type BucketEntry = { count: number; desde: number }
const rateBuckets = new Map<string, BucketEntry>()

function denegar(key: string, ip: string): boolean {
  const bucketKey = `${key}:${ip}`
  const now = Date.now()
  const entry = rateBuckets.get(bucketKey)
  if (!entry || now - entry.desde > VENTANA_MS) {
    rateBuckets.set(bucketKey, { count: 1, desde: now })
    return false
  }
  if (entry.count >= MAX_REQ_VENTANA) return true
  entry.count++
  return false
}

// Headers CORS comunes — se incluyen en TODAS las respuestas (200, 4xx, 5xx)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const { widget_key, mensaje, session_id } = body as {
      widget_key?: string
      mensaje?: string
      session_id?: string
    }

    // 1. Validación: mensaje requerido (falla rápido, no gasta DB lookup)
    if (!mensaje || typeof mensaje !== 'string') {
      return NextResponse.json(
        { error: 'mensaje requerido' },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    // 2. Validación: widget_key requerida
    if (!widget_key || typeof widget_key !== 'string') {
      return NextResponse.json(
        { error: 'widget_key requerida' },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    // 3. Validación: session_id requerido
    if (!session_id || typeof session_id !== 'string' || !session_id.trim()) {
      return NextResponse.json(
        { error: 'session_id requerido' },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    // 4. Resolver tenant a partir de widget_key
    const tenant = await resolverTenantPorWidgetKey(widget_key)
    if (!tenant) {
      return NextResponse.json(
        { error: 'widget no encontrado' },
        { status: 404, headers: CORS_HEADERS },
      )
    }

    // Rate-limit por widget_key + IP
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
    if (denegar(widget_key, ip)) {
      return NextResponse.json(
        { error: 'demasiados mensajes' },
        { status: 429, headers: CORS_HEADERS },
      )
    }

    const remitente = session_id.trim()

    const resultado = await atender({
      mensaje,
      canal: 'web',
      remitente,
      tenantId: tenant.tenantId,
    })

    // Para el canal web no exponemos campos internos del dashboard
    return NextResponse.json(
      {
        respuesta: resultado.respuesta,
        etapa: resultado.etapa,
        derivar: resultado.derivar,
        handoff: resultado.handoff,
      },
      { headers: CORS_HEADERS },
    )
  } catch (err) {
    console.error('widget/chat error', err)
    return NextResponse.json(
      { error: 'no se pudo procesar' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}

// Preflight CORS para el widget embebido en sitios externos
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}
