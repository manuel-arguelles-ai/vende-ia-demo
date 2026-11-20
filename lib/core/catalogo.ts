import { supabaseAdmin } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scoped } from './tenant'
import { embeberQuery, type EmbedQuery } from './embeddings'

// Match de un producto del catálogo (tabla productos cargada del PDF de Tienda Demo).
// confianza 'alta' = es lo que el cliente nombró; 'media' = pariente semántico, ofrecer
// como "lo más cercano que tenemos", nunca afirmarlo como lo pedido.
export type ProductoMatch = {
  nombre: string
  marca: string | null
  precio: number
  presentacion: string | null
  stock: number
  categoria: string | null
  descripcion: string | null
  confianza: 'alta' | 'media'
}

type Fila = {
  nombre: string
  marca: string | null
  precio: number | string
  presentacion: string | null
  stock: number
  categoria: string | null
  descripcion?: string | null
  metodos: string
  puntaje: number
  sim_vec: number | null
}

// Cortes de honestidad calibrados contra el catálogo real (2026-06-11):
// and/trgm = el nombre pedido matchea el catálogo → alta.
// vec >= 0.67, o or+vec con rrf >= 0.2 = cercano semántico → media.
// Resto = ruido: mejor un "no lo tenemos" honesto que vender fantasmas
// (ej. "limpiador de horno" topea en vec 0.63 y debe devolver vacío).
function clasificar(f: Fila): ProductoMatch | null {
  const metodos = f.metodos.split('+')
  let confianza: ProductoMatch['confianza'] | null = null
  if (metodos.includes('and') || metodos.includes('trgm')) confianza = 'alta'
  else if ((f.sim_vec ?? 0) >= 0.67) confianza = 'media'
  else if (metodos.includes('or') && metodos.includes('vec') && f.puntaje >= 0.2) confianza = 'media'
  if (!confianza) return null
  return {
    nombre: f.nombre,
    marca: f.marca,
    precio: Number(f.precio),
    presentacion: f.presentacion,
    stock: f.stock,
    categoria: f.categoria,
    descripcion: f.descripcion ?? null,
    confianza,
  }
}

// Búsqueda híbrida: léxico ponderado (AND > OR) + trigram (typos) + vectorial (pgvector),
// fusionados con RRF en la función SQL buscar_productos. Si no hay embedding de la query
// (sin key / error), corre léxico+trigram solo. Devuelve hasta 5 matches confiables.
export async function buscarProductos(
  producto: string | null,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
  embed: EmbedQuery = embeberQuery,
): Promise<ProductoMatch[]> {
  if (!producto || !producto.trim()) return []
  const q_emb = await embed(producto)
  const { data, error } = await db.rpc('buscar_productos', { q: producto, q_emb, lim: 5, p_tenant_id: tenantId })
  if (error || !data || !data.length) return []
  return (data as Fila[]).map(clasificar).filter((m): m is ProductoMatch => m !== null)
}

// Categorías/temas reales del catálogo del tenant (seccion + categoria + tags),
// para que el reformulador mapee consultas sin match a algo que SÍ existe.
export async function categoriasDelCatalogo(
  tenantId: number,
  db: SupabaseClient = supabaseAdmin(),
): Promise<string[]> {
  const { data, error } = await scoped(db, tenantId).from('productos').select('seccion,categoria,tags')
  if (error || !data) return []
  const set = new Set<string>()
  for (const r of data as { seccion: string | null; categoria: string | null; tags: string[] | null }[]) {
    for (const v of [r.seccion, r.categoria, ...(r.tags ?? [])]) {
      const t = (v ?? '').trim()
      if (t) set.add(t)
      if (set.size >= 40) break
    }
  }
  return [...set]
}

// Compat con el flujo legacy (procesar.ts): mejor match único o null.
export async function buscarProducto(
  producto: string | null,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
  embed: EmbedQuery = embeberQuery,
): Promise<ProductoMatch | null> {
  const matches = await buscarProductos(producto, tenantId, db, embed)
  return matches[0] ?? null
}
