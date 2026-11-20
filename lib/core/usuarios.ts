import { type SupabaseClient } from '@supabase/supabase-js'
import { hashPassword, verificarPassword } from '../auth'
import { supabaseAdmin } from './db'
import { scoped } from './tenant'
import { kpisPorAsesor, cargaPorAsesor } from './motor-asignacion'
import { obtenerNegocio } from './negocio'
import { registrarEvento } from './eventos'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface CrearTenantInput {
  nombre: string
  rubro: string
  email: string
  password: string
}

export interface CrearTenantResult {
  tenantId: number
  usuarioId: number
  widgetKey: string
}

export interface LoginResult {
  usuarioId: number
  tenantId: number
  rol: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convierte un nombre en slug: minúsculas, sin tildes, espacios → guiones. */
function slugify(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar marcas diacríticas
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // quitar caracteres no alfanuméricos (excepto guión)
    .replace(/\s+/g, '-')          // espacios → guiones
    .replace(/-+/g, '-')           // colapsar guiones múltiples
}

// ---------------------------------------------------------------------------
// crearTenantConAdmin
// ---------------------------------------------------------------------------

/**
 * Crea un tenant completo con su usuario admin y los registros de soporte.
 *
 * Orden:
 *   1. tenants        (nombre, rubro, slug)
 *   2. usuarios       (tenant_id, email, password_hash, rol='admin')
 *   3. canales        (tenant_id, tipo='web' — widget_key generado por DB)
 *   4. agente_perfil  (tenant_id, nombre_bot='Asistente')
 *   5. negocio        (tenant_id, datos={})
 *
 * @throws Error si el email ya existe (→ responder 409 en el endpoint)
 */
export async function crearTenantConAdmin(
  input: CrearTenantInput,
  db: SupabaseClient = supabaseAdmin(),
): Promise<CrearTenantResult> {
  const { nombre, rubro, email, password } = input
  const slug = slugify(nombre)

  // 1. Insertar tenant
  const { data: tenantData, error: tenantError } = await db
    .from('tenants')
    .insert({ nombre, rubro, slug })
    .select('id')
    .single()

  if (tenantError || !tenantData) {
    throw new Error(`Error al crear tenant: ${tenantError?.message ?? 'sin datos'}`)
  }

  const tenantId: number = (tenantData as { id: number }).id

  // 2. Insertar usuario admin (detectar email duplicado)
  const password_hash = hashPassword(password)
  const { data: usuarioData, error: usuarioError } = await db
    .from('usuarios')
    .insert({ tenant_id: tenantId, email, password_hash, rol: 'admin' })
    .select('id')
    .single()

  if (usuarioError || !usuarioData) {
    // Supabase devuelve código 23505 para unique violations
    const msg = usuarioError?.message ?? ''
    if (msg.includes('23505') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique')) {
      throw new Error(`EMAIL_DUPLICATE: el email ${email} ya está registrado`)
    }
    throw new Error(`Error al crear usuario: ${msg || 'sin datos'}`)
  }

  const usuarioId: number = (usuarioData as { id: number }).id

  // 3. Insertar canal web (widget_key generado por DB default)
  const { data: canalData, error: canalError } = await db
    .from('canales')
    .insert({ tenant_id: tenantId, tipo: 'web' })
    .select('widget_key')
    .single()

  if (canalError || !canalData) {
    throw new Error(`Error al crear canal: ${canalError?.message ?? 'sin datos'}`)
  }

  const widgetKey: string = (canalData as { widget_key: string }).widget_key

  // 4. Insertar agente_perfil con el nombre del negocio como identidad inicial
  const { error: agenteError } = await db
    .from('agente_perfil')
    .insert({ tenant_id: tenantId, nombre_bot: 'Asistente', negocio_nombre: nombre })

  if (agenteError) {
    throw new Error(`Error al crear agente_perfil: ${agenteError.message}`)
  }

  // 5. Insertar negocio
  const { error: negocioError } = await db
    .from('negocio')
    .insert({ tenant_id: tenantId, datos: {} })

  if (negocioError) {
    throw new Error(`Error al crear negocio: ${negocioError.message}`)
  }

  // Bitácora de plataforma (best-effort: no rompe el alta si falla).
  await registrarEvento('tenant_creado', tenantId, { nombre, rubro, email }, db)

  return { tenantId, usuarioId, widgetKey }
}

// ---------------------------------------------------------------------------
// verificarLogin
// ---------------------------------------------------------------------------

/**
 * Busca el usuario por email y verifica la contraseña.
 * Devuelve `{ usuarioId, tenantId, rol }` si las credenciales son correctas,
 * o `null` si el email no existe o la contraseña es incorrecta.
 */
export async function verificarLogin(
  email: string,
  password: string,
  db: SupabaseClient = supabaseAdmin(),
): Promise<LoginResult | null> {
  const { data, error } = await db
    .from('usuarios')
    .select('id, tenant_id, password_hash, rol, activo')
    .eq('email', email)
    .single()

  if (error || !data) return null

  const usuario = data as { id: number; tenant_id: number; password_hash: string; rol: string; activo: boolean | null }

  if (!verificarPassword(password, usuario.password_hash)) return null

  if (usuario.activo === false) return null

  // Verificar que el tenant no esté suspendido
  const { data: tenantData } = await db
    .from('tenants')
    .select('estado')
    .eq('id', usuario.tenant_id)
    .maybeSingle()

  if (tenantData && (tenantData as { estado: string }).estado === 'suspendido') return null

  return {
    usuarioId: usuario.id,
    tenantId: usuario.tenant_id,
    rol: usuario.rol,
  }
}

// ---------------------------------------------------------------------------
// crearAsesor
// ---------------------------------------------------------------------------

/**
 * Crea un usuario con rol='asesor' vinculado al tenant.
 * @throws Error con prefijo EMAIL_DUPLICATE si el email ya existe.
 */
export async function crearAsesor(
  input: { nombre: string; email: string; password: string },
  tenantId: number,
  db: SupabaseClient = supabaseAdmin(),
): Promise<{ usuarioId: number }> {
  const password_hash = hashPassword(input.password)
  const { data, error } = await db
    .from('usuarios')
    .insert({ tenant_id: tenantId, email: input.email, password_hash, rol: 'asesor', nombre: input.nombre, activo: true })
    .select('id')
    .single()
  if (error || !data) {
    const msg = error?.message ?? ''
    if (msg.includes('23505') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique')) {
      throw new Error(`EMAIL_DUPLICATE: el email ${input.email} ya está registrado`)
    }
    throw new Error(`Error al crear asesor: ${msg || 'sin datos'}`)
  }
  return { usuarioId: (data as { id: number }).id }
}

// ---------------------------------------------------------------------------
// listarUsuarios
// ---------------------------------------------------------------------------

/**
 * Lista todos los usuarios del tenant con el conteo de leads asignados a cada uno,
 * más peso, limite_activos, KPIs y saturado.
 */
export async function listarUsuarios(
  tenantId: number,
  db: SupabaseClient = supabaseAdmin(),
): Promise<{
  id: number
  nombre: string | null
  email: string
  rol: string
  activo: boolean
  leadsAsignados: number
  peso: number
  limite_activos: number | null
  kpis: { asignados: number; activos: number; cerrados: number; conversion: number }
  saturado: boolean
}[]> {
  const { data: usuarios } = await scoped(db, tenantId).from('usuarios').select('id,nombre,email,rol,activo,peso,limite_activos')
  const { data: leads } = await scoped(db, tenantId).from('control_leads').select('asignado_a')
  const conteo = new Map<number, number>()
  for (const l of (leads ?? []) as { asignado_a: number | null }[]) {
    if (l.asignado_a != null) conteo.set(l.asignado_a, (conteo.get(l.asignado_a) ?? 0) + 1)
  }
  const kpis = await kpisPorAsesor(tenantId, db)
  const carga = await cargaPorAsesor(tenantId, db)
  const negocio = await obtenerNegocio(tenantId, db)
  const limiteDefault = negocio.asignacion?.limite_default ?? 20
  return ((usuarios ?? []) as { id: number; nombre: string | null; email: string; rol: string; activo: boolean; peso: number | null; limite_activos: number | null }[])
    .map((u) => {
      const k = kpis.get(u.id) ?? { asignados: 0, activos: 0, cerrados: 0, conversion: 0 }
      const limiteActivos = u.limite_activos ?? null
      const activos = carga.get(u.id) ?? 0
      const saturado = activos >= (limiteActivos ?? limiteDefault)
      return {
        ...u,
        peso: u.peso ?? 1,
        limite_activos: limiteActivos,
        leadsAsignados: conteo.get(u.id) ?? 0,
        kpis: k,
        saturado,
      }
    })
}

// ---------------------------------------------------------------------------
// actualizarUsuario
// ---------------------------------------------------------------------------

/**
 * Actualiza nombre, activo, peso y/o limite_activos de un usuario, scoped por tenant+id.
 */
export async function actualizarUsuario(
  id: number,
  cambios: { nombre?: string; activo?: boolean; peso?: number; limite_activos?: number | null },
  tenantId: number,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (cambios.nombre !== undefined) payload.nombre = cambios.nombre
  if (cambios.activo !== undefined) payload.activo = cambios.activo
  if (cambios.peso !== undefined) payload.peso = cambios.peso
  if (cambios.limite_activos !== undefined) payload.limite_activos = cambios.limite_activos
  if (Object.keys(payload).length === 0) return
  const { error } = await db.from('usuarios').update(payload).eq('id', id).eq('tenant_id', tenantId)
  if (error) throw new Error(error.message)
}
