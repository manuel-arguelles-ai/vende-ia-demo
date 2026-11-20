import { NextResponse } from 'next/server'
import { procesarWebhook, verificarFirmaMP, type WebhookEvento } from '@/lib/core/billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Extrae el evento MP desde un Request (query params y/o body JSON).
 * MP puede enviar GET (query) o POST (body + query).
 * Defensivo: nunca lanza, devuelve valores vacíos si faltan campos.
 */
async function extraerEvento(req: Request): Promise<WebhookEvento> {
  const url = new URL(req.url)
  const params = url.searchParams

  // Query params: type (o topic), data.id (o id en fallback), id del evento
  const typeFromQuery = params.get('type') ?? params.get('topic') ?? undefined
  const dataIdFromQuery = params.get('data.id') ?? params.get('data_id') ?? undefined
  const idFromQuery = params.get('id') ?? undefined

  // Body JSON (solo en POST, GET no tiene body)
  let body: Record<string, unknown> = {}
  if (req.method === 'POST') {
    try {
      const text = await req.text()
      if (text) body = JSON.parse(text) as Record<string, unknown>
    } catch {
      // payload malformado → ignorar
    }
  }

  const bodyType = (body.type ?? body.topic) as string | undefined
  const bodyDataId = ((body.data as Record<string, unknown> | undefined)?.id ??
    body.data_id) as string | undefined
  const bodyId = body.id as string | undefined

  const type = typeFromQuery ?? bodyType ?? 'unknown'
  const dataId = dataIdFromQuery ?? bodyDataId ?? bodyId ?? 'unknown'
  const id = idFromQuery ?? bodyId ?? dataIdFromQuery ?? bodyDataId ?? 'unknown'

  return { id, type, dataId }
}

async function handleWebhook(req: Request): Promise<Response> {
  const evento = await extraerEvento(req)

  const firmaValida = verificarFirmaMP({
    xSignature: req.headers.get('x-signature'),
    xRequestId: req.headers.get('x-request-id'),
    dataId: evento.dataId,
    secret: process.env.MP_WEBHOOK_SECRET,
  })
  if (!firmaValida) {
    return NextResponse.json({ error: 'firma inválida' }, { status: 401 })
  }

  try {
    await procesarWebhook(evento)
  } catch (err) {
    // MP reintenta si no recibe 200 → siempre responder 200
    console.error('[webhook/mp] error procesando evento:', err)
  }
  return NextResponse.json({ ok: true }, { status: 200 })
}

export async function POST(req: Request): Promise<Response> {
  return handleWebhook(req)
}

export async function GET(req: Request): Promise<Response> {
  return handleWebhook(req)
}
