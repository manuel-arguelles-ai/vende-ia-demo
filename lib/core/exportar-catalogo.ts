import type { Formato } from './importar-catalogo'

export type ProductoRow = {
  nombre: string; marca: string | null; categoria: string | null; descripcion: string | null
  precio: number; presentacion: string | null; stock: number; seccion: string | null
  sku: string | null; tags: string[] | null; atributos: Record<string, unknown> | null
}

const HEADER_LIBROS = ['isbn', 'titulo', 'autor', 'editorial', 'edicion', 'anio', 'precio_soles', 'stock_total', 'genero', 'descripcion']
const HEADER_GENERICO = ['nombre', 'precio', 'stock', 'categoria', 'marca', 'presentacion', 'descripcion', 'sku', 'tags']

export function esquemaDelTenant(productos: ProductoRow[]): Formato {
  const señales = productos.filter((p) => (p.atributos && 'autor' in p.atributos) || (p.sku && /^\d{13}$/.test(p.sku))).length
  return productos.length > 0 && señales >= productos.length / 2 ? 'libros' : 'generico'
}

export function filasExport(productos: ProductoRow[], formato: Formato): { header: string[]; filas: string[][] } {
  if (formato === 'libros') {
    const filas = productos.map((p) => {
      const a = p.atributos ?? {}
      return [
        p.sku ?? '', p.nombre ?? '', String(a.autor ?? ''), p.marca ?? '',
        String(a.edicion ?? ''), String(a.anio ?? ''), String(p.precio ?? ''),
        String(p.stock ?? ''), (p.tags ?? [])[0] ?? '', p.descripcion ?? '',
      ]
    })
    return { header: HEADER_LIBROS, filas }
  }
  const filas = productos.map((p) => [
    p.nombre ?? '', String(p.precio ?? ''), String(p.stock ?? ''), p.categoria ?? '',
    p.marca ?? '', p.presentacion ?? '', p.descripcion ?? '', p.sku ?? '', (p.tags ?? []).join(','),
  ])
  return { header: HEADER_GENERICO, filas }
}
