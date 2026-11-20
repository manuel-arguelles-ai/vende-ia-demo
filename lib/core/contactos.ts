import { supabaseAdmin } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scoped } from './tenant'

// Ficha de contacto auto-enriquecida (cero data-entry): Nina detecta nombre y
// ciudad en la conversación (extraer.ts los emite en extra) y acá se persisten.
// El asesor puede editarla a mano desde el CRM.
export type Contacto = {
  remitente: string
  nombre: string | null
  ciudad: string | null
  telefono: string | null
  productos: string[]
  actualizado?: string
}

// Lectura puntual de un contacto (para que el agente no re-pregunte datos ya conocidos).
export async function obtenerContacto(
  remitente: string,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<Contacto | null> {
  const { data } = await scoped(db, tenantId).from('contactos').select('*').eq('remitente', remitente).maybeSingle()
  return (data as Contacto | null) ?? null
}

// C3 — marca/desmarca el opt-out de marketing del contacto (lo respeta el motor de seguimiento).
export async function marcarOptoutMarketing(
  remitente: string,
  valor: boolean,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  await db.from('contactos').upsert(
    { remitente, tenant_id: tenantId, optout_marketing: valor, actualizado: new Date().toISOString() },
    { onConflict: 'remitente,tenant_id' },
  )
}

// Merge no destructivo: solo escribe campos nuevos (no pisa lo que ya hay,
// salvo que venga un valor y el guardado esté vacío). Acumula productos únicos.
export async function enriquecerContacto(
  remitente: string,
  datos: { nombre?: string | null; ciudad?: string | null; telefono?: string | null; producto?: string | null },
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  const { data } = await scoped(db, tenantId).from('contactos').select('*').eq('remitente', remitente).maybeSingle()
  const actual = (data as Contacto | null) ?? { remitente, nombre: null, ciudad: null, telefono: null, productos: [] }

  const productos = [...actual.productos]
  const p = datos.producto?.trim().toLowerCase()
  if (p && !productos.includes(p)) productos.push(p)

  const fila = {
    remitente,
    tenant_id: tenantId,
    nombre: actual.nombre ?? datos.nombre?.trim() ?? null,
    ciudad: actual.ciudad ?? datos.ciudad?.trim() ?? null,
    telefono: actual.telefono ?? datos.telefono ?? null,
    productos: productos.slice(0, 15),
    actualizado: new Date().toISOString(),
  }
  // Evita writes si no hay nada nuevo
  if (
    fila.nombre === actual.nombre &&
    fila.ciudad === actual.ciudad &&
    fila.telefono === actual.telefono &&
    fila.productos.length === actual.productos.length
  )
    return
  await db.from('contactos').upsert(fila, { onConflict: 'remitente,tenant_id' })
}

// Edición manual desde el CRM (sí pisa valores).
export async function guardarContacto(
  remitente: string,
  datos: { nombre?: string | null; ciudad?: string | null },
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  const { error } = await db
    .from('contactos')
    .upsert(
      { remitente, tenant_id: tenantId, ...datos, actualizado: new Date().toISOString() },
      { onConflict: 'remitente,tenant_id' },
    )
  if (error) throw new Error(error.message)
}

export async function eliminarContacto(
  remitente: string,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  const { error } = await scoped(db, tenantId).from('contactos').delete().eq('remitente', remitente)
  if (error) throw new Error(error.message)
}

export async function listarContactos(
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<Contacto[]> {
  const { data, error } = await scoped(db, tenantId)
    .from('contactos')
    .select('*')
    .order('actualizado', { ascending: false })
  if (error || !data) return []
  return data as Contacto[]
}

// Mapa remitente → contacto, para adjuntar al dashboard.
export async function contactosPorRemitente(
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<Map<string, Contacto>> {
  const mapa = new Map<string, Contacto>()
  for (const c of await listarContactos(tenantId, db)) mapa.set(c.remitente, c)
  return mapa
}
