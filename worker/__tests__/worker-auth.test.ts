import { describe, it, expect } from 'vitest'
import { workerAuthOk } from '../workerAuth'

describe('workerAuthOk — fail-closed auth', () => {
  it('sin token y sin WORKER_DEV → denegar (fail-closed)', () => {
    expect(workerAuthOk(undefined, {})).toBe(false)
  })

  it('WORKER_DEV=1 → permitir aunque no haya token', () => {
    expect(workerAuthOk(undefined, { WORKER_DEV: '1' })).toBe(true)
  })

  it('token configurado + Bearer correcto → permitir', () => {
    expect(workerAuthOk('Bearer secreto', { WORKER_TOKEN: 'secreto' })).toBe(true)
  })

  it('token configurado + Bearer incorrecto → denegar', () => {
    expect(workerAuthOk('Bearer malo', { WORKER_TOKEN: 'secreto' })).toBe(false)
  })

  it('token configurado + sin header → denegar', () => {
    expect(workerAuthOk(undefined, { WORKER_TOKEN: 'secreto' })).toBe(false)
  })
})
