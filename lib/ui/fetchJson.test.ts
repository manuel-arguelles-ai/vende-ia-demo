import { describe, it, expect, vi, afterEach } from 'vitest'
import { mutar, postJson } from './fetchJson'

afterEach(() => vi.restoreAllMocks())

function fakeResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('mutar', () => {
  it('res.ok → { ok:true, data }', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeResponse(200, { id: 1 }))
    const r = await mutar('/x')
    expect(r).toEqual({ ok: true, data: { id: 1 } })
  })

  it('!res.ok con body.error → { ok:false, error } con el mensaje del server', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeResponse(403, { error: 'sin acceso a este lead' }))
    const r = await mutar('/x')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('sin acceso a este lead')
  })

  it('!res.ok sin body → error genérico con el status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeResponse(500, undefined))
    const r = await mutar('/x')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('500')
  })

  it('fetch lanza (red caída) → { ok:false } sin propagar', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'))
    const r = await mutar('/x')
    expect(r.ok).toBe(false)
  })
})

describe('postJson', () => {
  it('serializa el body y usa POST por defecto', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeResponse(200, { ok: true }))
    await postJson('/x', { a: 1 })
    const [, opts] = spy.mock.calls[0]
    expect(opts?.method).toBe('POST')
    expect(opts?.body).toBe(JSON.stringify({ a: 1 }))
  })
})
