import { describe, it, expect } from 'vitest'
import { filasDeRequest } from '@/lib/core/importar-request'

function multipart(contenido: Buffer, nombre: string, modo: string): Request {
  const fd = new FormData()
  fd.append('file', new File([new Uint8Array(contenido)], nombre))
  fd.append('modo', modo)
  return new Request('http://x/api/catalogo/importar', { method: 'POST', body: fd })
}

describe('filasDeRequest', () => {
  it('multipart CSV → filas + modo', async () => {
    const req = multipart(Buffer.from('nombre,precio\nAceite,49\n', 'utf-8'), 'c.csv', 'reemplazar')
    const { filas, modo } = await filasDeRequest(req)
    expect(filas).toEqual([['nombre', 'precio'], ['Aceite', '49']])
    expect(modo).toBe('reemplazar')
  })
  it('JSON {csv,modo} sigue funcionando', async () => {
    const req = new Request('http://x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csv: 'nombre,precio\nA,1\n', modo: 'actualizar' }) })
    const { filas, modo } = await filasDeRequest(req)
    expect(filas[0]).toEqual(['nombre', 'precio']); expect(modo).toBe('actualizar')
  })
})
