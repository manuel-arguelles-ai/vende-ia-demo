import { supabaseAdmin } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scoped } from './tenant'

export type Tono = 'cercano' | 'neutral' | 'formal'
export type Longitud = 'cortas' | 'medias'
export type IntensidadCierre = 'informativo' | 'equilibrado' | 'cerrador'
export type Agresividad = 'suave' | 'media' | 'alta'

export type AgentePerfil = {
  nombreBot: string | null
  tono: Tono
  instruccionesExtra: string | null
  negocioNombre: string | null
  rubro: string | null
  categorias: string | null
  saludoInicial: string | null
  mensajeNoSe: string | null
  temasProhibidos: string | null
  emojis: boolean
  longitud: Longitud
  intensidadCierre: IntensidadCierre
  agresividad: Agresividad
}

const DEFAULTS: AgentePerfil = {
  nombreBot: null,
  tono: 'cercano',
  instruccionesExtra: null,
  negocioNombre: null,
  rubro: null,
  categorias: null,
  saludoInicial: null,
  mensajeNoSe: null,
  temasProhibidos: null,
  emojis: true,
  longitud: 'cortas',
  intensidadCierre: 'cerrador',
  agresividad: 'suave',
}

type FilaPerfil = {
  nombre_bot: string | null
  tono: string | null
  instrucciones_extra: string | null
  negocio_nombre: string | null
  rubro: string | null
  categorias: string | null
  saludo_inicial: string | null
  mensaje_no_se: string | null
  temas_prohibidos: string | null
  emojis: boolean | null
  longitud: string | null
  intensidad_cierre: string | null
  agresividad: string | null
}

const COLS =
  'nombre_bot,tono,instrucciones_extra,negocio_nombre,rubro,categorias,saludo_inicial,mensaje_no_se,temas_prohibidos,emojis,longitud,intensidad_cierre,agresividad'

export async function obtenerPerfil(
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<AgentePerfil> {
  const { data, error } = await scoped(db, tenantId).from('agente_perfil').select(COLS).maybeSingle()
  if (error || !data) return { ...DEFAULTS }
  const f = data as FilaPerfil
  return {
    nombreBot: f.nombre_bot ?? null,
    tono: (f.tono as Tono) ?? DEFAULTS.tono,
    instruccionesExtra: f.instrucciones_extra ?? null,
    negocioNombre: f.negocio_nombre ?? null,
    rubro: f.rubro ?? null,
    categorias: f.categorias ?? null,
    saludoInicial: f.saludo_inicial ?? null,
    mensajeNoSe: f.mensaje_no_se ?? null,
    temasProhibidos: f.temas_prohibidos ?? null,
    emojis: f.emojis ?? DEFAULTS.emojis,
    longitud: (f.longitud as Longitud) ?? DEFAULTS.longitud,
    intensidadCierre: (f.intensidad_cierre as IntensidadCierre) ?? DEFAULTS.intensidadCierre,
    agresividad: (f.agresividad as Agresividad) ?? DEFAULTS.agresividad,
  }
}

export async function guardarPerfil(
  perfil: Partial<AgentePerfil>,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  const fila: Record<string, unknown> = { tenant_id: tenantId }
  const map: Record<keyof AgentePerfil, string> = {
    nombreBot: 'nombre_bot', tono: 'tono', instruccionesExtra: 'instrucciones_extra',
    negocioNombre: 'negocio_nombre', rubro: 'rubro', categorias: 'categorias',
    saludoInicial: 'saludo_inicial', mensajeNoSe: 'mensaje_no_se', temasProhibidos: 'temas_prohibidos',
    emojis: 'emojis', longitud: 'longitud', intensidadCierre: 'intensidad_cierre', agresividad: 'agresividad',
  }
  for (const [k, col] of Object.entries(map)) {
    const v = perfil[k as keyof AgentePerfil]
    if (v !== undefined) fila[col] = v
  }
  const { error } = await db.from('agente_perfil').upsert(fila, { onConflict: 'tenant_id' })
  if (error) throw new Error(error.message)
}
