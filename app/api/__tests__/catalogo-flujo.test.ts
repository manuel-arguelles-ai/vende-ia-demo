import { describe, it, expect, vi, beforeEach } from 'vitest'

const tenantDeSesion = vi.fn()
const previsualizar = vi.fn()
const importar = vi.fn()
const resumenEnriquecer = vi.fn()
const enriquecer = vi.fn()
vi.mock('@/lib/core/sesion-helper', () => ({ tenantDeSesion: (...a: unknown[]) => tenantDeSesion(...a) }))
vi.mock('@/lib/core/autorizacion', () => ({ asesorPuedeEditar: () => Promise.resolve(true) }))
vi.mock('@/lib/core/importar-catalogo', async (orig) => ({ ...(await orig() as object), previsualizar: (...a: unknown[]) => previsualizar(...a), importar: (...a: unknown[]) => importar(...a) }))
vi.mock('@/lib/core/enriquecer-catalogo', () => ({ resumenEnriquecer: (...a: unknown[]) => resumenEnriquecer(...a), enriquecer: (...a: unknown[]) => enriquecer(...a) }))

import { POST as PREVIEW } from '../../api/catalogo/importar/preview/route'
import { POST as IMPORTAR } from '../../api/catalogo/importar/route'
import { POST as ENRIQUECER } from '../../api/catalogo/enriquecer/route'

const req = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body) })
beforeEach(() => { [tenantDeSesion, previsualizar, importar, resumenEnriquecer, enriquecer].forEach((m) => m.mockReset()) })

describe('catálogo flujo', () => {
  it('preview sin sesión → 401', async () => {
    tenantDeSesion.mockResolvedValue(null)
    expect((await PREVIEW(req({ csv: 'a' }))).status).toBe(401)
  })
  it('preview → resumen', async () => {
    tenantDeSesion.mockResolvedValue({ tenantId: 6 })
    previsualizar.mockResolvedValue({ formato: 'libros', validas: 2 })
    const res = await PREVIEW(req({ csv: 'isbn,titulo\n1,x' }))
    expect(res.status).toBe(200)
    expect(importar).not.toHaveBeenCalled()
    expect(previsualizar).toHaveBeenCalled()
  })
  it('importar con modo → llama importar con el tenant de sesión', async () => {
    tenantDeSesion.mockResolvedValue({ tenantId: 6 })
    importar.mockResolvedValue({ importados: 1, actualizados: 1, omitidas: 0 })
    const res = await IMPORTAR(req({ csv: 'isbn,titulo\n1,x', modo: 'reemplazar' }))
    expect(res.status).toBe(200)
    const args = importar.mock.calls[0]
    expect(args[1]).toBe('reemplazar'); expect(args[2]).toBe(6)
  })
  it('enriquecer dryRun → resumen, sin correr enriquecer', async () => {
    tenantDeSesion.mockResolvedValue({ tenantId: 6 })
    resumenEnriquecer.mockResolvedValue({ total: 3, sinDescripcion: 2, sinGenero: 1 })
    const res = await ENRIQUECER(req({ dryRun: true }))
    expect(res.status).toBe(200)
    expect(enriquecer).not.toHaveBeenCalled()
  })
})
