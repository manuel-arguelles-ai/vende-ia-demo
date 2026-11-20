import { describe, it, expect } from 'vitest'
import { esquemaDelTenant, filasExport, type ProductoRow } from '../exportar-catalogo'

const libro: ProductoRow = {
  nombre: 'El Proceso', marca: 'Tusquets', categoria: null, descripcion: 'Clásico',
  precio: 50, presentacion: null, stock: 3, seccion: null, sku: '9786120000000',
  tags: ['novela'], atributos: { autor: 'Kafka', anio: '1925' },
}
const generico: ProductoRow = {
  nombre: 'Aceite', marca: 'BioSelva', categoria: 'alimentación', descripcion: 'Prensado',
  precio: 49, presentacion: '500 ml', stock: 10, seccion: 'aceites', sku: 'SKU-1',
  tags: ['organico'], atributos: null,
}

describe('esquemaDelTenant', () => {
  it('detecta libros por atributos.autor', () => { expect(esquemaDelTenant([libro])).toBe('libros') })
  it('genérico cuando no hay señales de libro', () => { expect(esquemaDelTenant([generico])).toBe('generico') })
})

describe('filasExport', () => {
  it('libros: header e isbn/titulo/autor/editorial/genero', () => {
    const { header, filas } = filasExport([libro], 'libros')
    expect(header).toContain('isbn'); expect(header).toContain('titulo')
    const row = Object.fromEntries(header.map((h, i) => [h, filas[0][i]]))
    expect(row.titulo).toBe('El Proceso'); expect(row.autor).toBe('Kafka')
    expect(row.editorial).toBe('Tusquets'); expect(row.isbn).toBe('9786120000000')
    expect(row.genero).toBe('novela'); expect(row.precio_soles).toBe('50')
  })
  it('genérico: nombre/precio/sku/tags', () => {
    const { header, filas } = filasExport([generico], 'generico')
    const row = Object.fromEntries(header.map((h, i) => [h, filas[0][i]]))
    expect(row.nombre).toBe('Aceite'); expect(row.precio).toBe('49'); expect(row.sku).toBe('SKU-1')
  })
})
