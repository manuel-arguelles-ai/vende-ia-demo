/**
 * Tests unitarios del parser CSV interno de app/api/catalogo/importar/route.ts
 * Separados en su propio archivo para evitar timeout en suite fría cuando
 * el test era co-localizado en registro.test.ts (import del route de importar
 * arrastraba cookies/headers de Next.js y tardaba en resolver).
 */
import { describe, it, expect } from 'vitest'
import { parsearCSV } from '@/lib/core/importar-catalogo'

describe('parser CSV interno (importar/route)', () => {
  it('campo entre comillas con coma interna se parsea como un solo campo', () => {
    const csv = `nombre,descripcion\n"Producto A","Descripcion con, coma interna"\n`
    const rows = parsearCSV(csv)

    expect(rows).toHaveLength(2) // header + 1 fila
    expect(rows[1]).toHaveLength(2)
    expect(rows[1][0]).toBe('Producto A')
    expect(rows[1][1]).toBe('Descripcion con, coma interna')
  })

  it('campo entre comillas con salto de línea interno se parsea como un solo campo', () => {
    const csv = `nombre,descripcion\n"Prod B","Linea uno\nLinea dos"\n`
    const rows = parsearCSV(csv)

    expect(rows).toHaveLength(2)
    expect(rows[1][1]).toBe('Linea uno\nLinea dos')
  })
})
