/**
 * Tests para el endpoint público del widget de chat web.
 * Ruta: app/api/widget/chat/route.ts
 *
 * Casos cubiertos:
 * 1. widget_key válida + mensaje → responde 200 con {respuesta, etapa} + CORS header
 * 2. widget_key inválida → 404 {"error":"widget no encontrado"}
 * 3. sin mensaje → 400 {"error":"mensaje requerido"}
 * 4. widget_key faltante → 400 {"error":"widget_key requerida"}
 * 5. session_id ausente → 400 {"error":"session_id requerido"}
 * 6. rate-limit excedido → 429 {"error":"demasiados mensajes"}
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- mocks antes de importar el módulo bajo test ----
vi.mock('@/lib/core/tenant', () => ({
  resolverTenantPorWidgetKey: vi.fn(),
}))

vi.mock('@/lib/core/atender', () => ({
  atender: vi.fn(),
}))

import { POST } from '../chat/route'
import { resolverTenantPorWidgetKey } from '@/lib/core/tenant'
import { atender } from '@/lib/core/atender'

// Helpers para construir un Request mínimo compatible con Next.js route handlers
function makeRequest(body: unknown, url = 'http://localhost/api/widget/chat') {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/widget/chat', () => {
  it('responde 200 con {respuesta, etapa} y header CORS cuando la widget_key es válida y hay mensaje', async () => {
    vi.mocked(resolverTenantPorWidgetKey).mockResolvedValue({ tenantId: 3 })
    vi.mocked(atender).mockResolvedValue({
      respuesta: 'Hola, bienvenido!',
      etapa: 'enganche',
      derivar: false,
      handoff: null,
      saved: null,
    })

    const req = makeRequest({
      widget_key: 'wk-valid-abc',
      mensaje: 'Hola',
      session_id: 'visitante-1',
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toHaveProperty('respuesta', 'Hola, bienvenido!')
    expect(data).toHaveProperty('etapa', 'enganche')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(resolverTenantPorWidgetKey).toHaveBeenCalledWith('wk-valid-abc')
    expect(atender).toHaveBeenCalledWith(
      expect.objectContaining({
        mensaje: 'Hola',
        canal: 'web',
        remitente: 'visitante-1',
        tenantId: 3,
      }),
    )
  })

  it('responde 404 con error cuando la widget_key no existe', async () => {
    vi.mocked(resolverTenantPorWidgetKey).mockResolvedValue(null)

    const req = makeRequest({
      widget_key: 'wk-no-existe',
      mensaje: 'Hola',
      session_id: 'visitante-1',
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data).toHaveProperty('error', 'widget no encontrado')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('responde 400 cuando falta el mensaje', async () => {
    const req = makeRequest({
      widget_key: 'wk-valid-abc',
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toHaveProperty('error', 'mensaje requerido')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('responde 400 cuando falta la widget_key', async () => {
    const req = makeRequest({
      mensaje: 'Hola',
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toHaveProperty('error', 'widget_key requerida')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('responde 400 cuando falta session_id', async () => {
    const req = makeRequest({
      widget_key: 'wk-valid-abc',
      mensaje: 'Hola',
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toHaveProperty('error', 'session_id requerido')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('responde 429 cuando se excede el rate-limit', async () => {
    vi.mocked(resolverTenantPorWidgetKey).mockResolvedValue({ tenantId: 3 })
    vi.mocked(atender).mockResolvedValue({
      respuesta: 'ok',
      etapa: 'enganche',
      derivar: false,
      handoff: null,
      saved: null,
    })

    // Usar una key única para no colisionar con otros tests
    const rl_key = 'wk-ratelimit-' + Date.now()
    const ip = '1.2.3.99'

    // Agotar el límite (MAX_REQ_VENTANA = 20)
    for (let i = 0; i < 20; i++) {
      const req = new Request('http://localhost/api/widget/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify({ widget_key: rl_key, mensaje: 'ping', session_id: 'sess-rl' }),
      })
      await POST(req)
    }

    // La 21ª debe ser bloqueada
    const req21 = new Request('http://localhost/api/widget/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ widget_key: rl_key, mensaje: 'ping', session_id: 'sess-rl' }),
    })
    const res = await POST(req21)
    const data = await res.json()

    expect(res.status).toBe(429)
    expect(data).toHaveProperty('error', 'demasiados mensajes')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})
