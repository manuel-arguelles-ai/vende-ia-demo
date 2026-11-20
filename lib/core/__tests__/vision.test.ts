import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { describirImagen, planTieneVision } from '../vision'

describe('planTieneVision', () => {
  it('free no; pro/max/enterprise sí', () => {
    expect(planTieneVision('free')).toBe(false)
    expect(planTieneVision('pro')).toBe(true)
    expect(planTieneVision('max')).toBe(true)
    expect(planTieneVision('enterprise')).toBe(true)
    expect(planTieneVision('inexistente')).toBe(false)
  })
})

describe('describirImagen', () => {
  const buf = Buffer.from('fake-image-bytes')
  beforeEach(() => { process.env.GEMINI_API_KEY = 'test-key' })
  afterEach(() => { delete process.env.GEMINI_API_KEY })

  it('sin GEMINI_API_KEY → null, sin llamar fetch', async () => {
    delete process.env.GEMINI_API_KEY
    const fetchFn = vi.fn() as unknown as typeof fetch
    expect(await describirImagen(buf, 'image/jpeg', fetchFn)).toBeNull()
    expect((fetchFn as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0)
  })
  it('Gemini OK → descripción trim', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '  Aceite de coco BioSelva 500 ml  ' }] } }] }) })) as unknown as typeof fetch
    expect(await describirImagen(buf, 'image/jpeg', fetchFn)).toBe('Aceite de coco BioSelva 500 ml')
  })
  it('Gemini no-ok → null', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch
    expect(await describirImagen(buf, 'image/jpeg', fetchFn)).toBeNull()
  })
  it('fetch throw → null (best-effort)', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('timeout') }) as unknown as typeof fetch
    expect(await describirImagen(buf, 'image/jpeg', fetchFn)).toBeNull()
  })
  it('respuesta sin candidates → null', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch
    expect(await describirImagen(buf, 'image/jpeg', fetchFn)).toBeNull()
  })
})
