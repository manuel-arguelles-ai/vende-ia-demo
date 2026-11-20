import { supabaseAdmin } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scoped } from './tenant'
import { chatJson, type ChatJson } from './llm'
import { embeberDocumento } from './embeddings'

const CAP_ENRIQUECER = 500

type Prod = { id: number; nombre: string; marca: string | null; descripcion: string | null; tags: string[] | null; atributos: Record<string, unknown> | null }

function falta(p: Prod): boolean {
  return !p.descripcion || !p.tags || p.tags.length === 0
}

export async function resumenEnriquecer(
  tenantId: number, db: SupabaseClient = supabaseAdmin(),
): Promise<{ total: number; sinDescripcion: number; sinGenero: number }> {
  const { data } = await scoped(db, tenantId).from('productos').select('id,nombre,marca,descripcion,tags,atributos')
  const prods = (data ?? []) as Prod[]
  return {
    total: prods.length,
    sinDescripcion: prods.filter((p) => !p.descripcion).length,
    sinGenero: prods.filter((p) => !p.tags || p.tags.length === 0).length,
  }
}

export async function enriquecer(
  tenantId: number,
  db: SupabaseClient = supabaseAdmin(),
  chat: ChatJson = chatJson,
  embed: (t: string) => Promise<number[] | null> = embeberDocumento,
): Promise<{ enriquecidos: number; recortadas?: boolean }> {
  const s = scoped(db, tenantId)
  const { data } = await s.from('productos').select('id,nombre,marca,descripcion,tags,atributos')
  let pendientes = ((data ?? []) as Prod[]).filter(falta)
  const recortadas = pendientes.length > CAP_ENRIQUECER
  if (recortadas) pendientes = pendientes.slice(0, CAP_ENRIQUECER)
  let enriquecidos = 0
  for (const p of pendientes) {
    try {
      const autor = (p.atributos?.autor as string) ?? ''
      const out = (await chat({
        system: 'Sos un catalogador. Devolvé SOLO JSON {"descripcion": string (1 frase para búsqueda semántica), "tags": string[] (1-3 géneros/temas)}. No inventes datos que no se deduzcan del nombre/autor.',
        user: `Producto: ${p.nombre}${autor ? ' — autor: ' + autor : ''}${p.marca ? ' — ' + p.marca : ''}`,
      })) as { descripcion?: string; tags?: string[] }
      const nuevaDesc = p.descripcion || out.descripcion || null
      const nuevasTags = (p.tags && p.tags.length ? p.tags : out.tags) || null
      const textoEmb = [p.nombre, autor, p.marca, (nuevasTags ?? []).join(' '), nuevaDesc].filter(Boolean).join(' ')
      const e = await embed(textoEmb)
      const payload: Record<string, unknown> = { descripcion: nuevaDesc, tags: nuevasTags }
      if (Array.isArray(e)) payload.embedding = e
      await s.from('productos').update(payload).eq('id', p.id)
      enriquecidos++
    } catch { /* best-effort: seguir con la siguiente */ }
  }
  return { enriquecidos, ...(recortadas ? { recortadas } : {}) }
}
