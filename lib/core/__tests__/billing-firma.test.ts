import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verificarFirmaMP } from '../billing'

function firmaValida(secret: string, dataId: string, requestId: string, ts: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex')
  return `ts=${ts},v1=${v1}`
}

describe('verificarFirmaMP', () => {
  const secret = 'mp-secret'
  it('firma válida → true', () => {
    const ts = '1700000000'
    const sig = firmaValida(secret, 'PAY-1', 'req-1', ts)
    expect(verificarFirmaMP({ xSignature: sig, xRequestId: 'req-1', dataId: 'PAY-1', secret })).toBe(true)
  })
  it('firma inválida → false', () => {
    expect(verificarFirmaMP({ xSignature: 'ts=1,v1=deadbeef', xRequestId: 'req-1', dataId: 'PAY-1', secret })).toBe(false)
  })
  it('sin secret → false', () => {
    const sig = firmaValida(secret, 'PAY-1', 'req-1', '1700000000')
    expect(verificarFirmaMP({ xSignature: sig, xRequestId: 'req-1', dataId: 'PAY-1', secret: undefined })).toBe(false)
  })
  it('header malformado → false', () => {
    expect(verificarFirmaMP({ xSignature: 'basura', xRequestId: 'r', dataId: 'd', secret })).toBe(false)
  })
})
