import { supabaseAdmin } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scoped } from './tenant'

// Configuración del negocio (una sola fila jsonb): datos de pago, horarios,
// delivery, plantillas. La edita el asesor desde el panel "Mi negocio" y la
// usan: los botones de insertar snippet, las plantillas "/" y las sugerencias IA.
export type ReglaAsignacion = 'off' | 'round_robin' | 'ponderada' | 'carga'

export type DatosNegocio = {
  nombre?: string
  yape?: string
  plin?: string
  titular?: string // titular por defecto (fallback si no hay uno específico por método)
  titular_yape?: string
  titular_plin?: string
  titular_cuenta?: string // titular de la cuenta bancaria
  banco?: string
  cuenta?: string
  tipo_cuenta?: 'corriente' | 'ahorros'
  cci?: string
  horario?: string
  delivery?: string
  politicas?: string
  // Modo de venta del agente: 'cierre' = lleva la venta hasta el pedido confirmado;
  // 'derivar' = atiende e informa y deriva al asesor apenas el lead está caliente.
  modo_venta?: 'cierre' | 'derivar'
  // Modo privado: si true, el agente solo responde a números en numeros_autorizados;
  // el resto queda en silencio (se registra en CRM con silenciado=true). Default false.
  allowlist_activo?: boolean
  // Cierre de ventas: true = el agente registra venta/reserva automáticamente (detección
  // determinista de forma+tienda); false = lo cierra el asesor desde el CRM. Default true.
  cierre_auto?: boolean
  // Seguimiento proactivo (re-enganche de cotización abandonada + postventa). Default FALSE:
  // no se envía nada hasta que el inquilino lo active explícitamente. Lo aplica el worker.
  seguimiento_auto?: boolean
  // plantillas propias del asesor: atajo (sin "/") → texto
  plantillas?: Record<string, string>
  asignacion?: { regla: ReglaAsignacion; limite_default: number; ultimo_asesor_id: number | null }
  // Permisos del asesor por sección (configurable por el admin del inquilino).
  permisos_asesor?: import('./permisos').PermisosAsesor
}

export async function obtenerNegocio(
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<DatosNegocio> {
  const { data, error } = await scoped(db, tenantId).from('negocio').select('datos').maybeSingle()
  if (error || !data) return {}
  return ((data as { datos: DatosNegocio }).datos ?? {})
}

export async function guardarNegocio(
  datos: DatosNegocio,
  tenantId: number = 1,
  db: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  const { error } = await db.from('negocio').upsert({ tenant_id: tenantId, datos }, { onConflict: 'tenant_id' })
  if (error) throw new Error(error.message)
}

// Texto compacto con los datos de pago/operativos para el prompt de sugerencias.
export function resumenNegocio(n: DatosNegocio): string {
  const partes: string[] = []
  if (n.nombre) partes.push(`Negocio: ${n.nombre}`)
  if (n.yape) partes.push(`Yape: ${n.yape}`)
  if (n.plin) partes.push(`Plin: ${n.plin}`)
  if (n.titular) partes.push(`Titular: ${n.titular}`)
  if (n.banco && n.cuenta) partes.push(`Cuenta ${n.banco}: ${n.cuenta}`)
  if (n.cci) partes.push(`CCI: ${n.cci}`)
  if (n.horario) partes.push(`Horario: ${n.horario}`)
  if (n.delivery) partes.push(`Delivery: ${n.delivery}`)
  if (n.politicas) partes.push(`Políticas: ${n.politicas}`)
  return partes.join('\n')
}
