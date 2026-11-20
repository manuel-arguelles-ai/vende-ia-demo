import { NextResponse } from 'next/server'
import { tenantDeSesion } from '@/lib/core/sesion-helper'
import { supabaseAdmin } from '@/lib/core/db'
import { obtenerPerfil } from '@/lib/core/perfil'
import { obtenerNegocio } from '@/lib/core/negocio'
import { estadoLimiteMensajes } from '@/lib/core/limites'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const sesion = await tenantDeSesion()
  if (!sesion) return NextResponse.json({ error: 'no autorizado' }, { status: 401 })

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('tenants')
    .select('nombre, plan, sub_estado, sub_proximo_cobro, trial_fin')
    .eq('id', sesion.tenantId)
    .single()
  if (error || !data) return NextResponse.json({ error: 'tenant no encontrado' }, { status: 404 })

  const row = data as { nombre: string | null; plan: string; sub_estado: string | null; sub_proximo_cobro: string | null; trial_fin: string | null }

  const perfil = await obtenerPerfil(sesion.tenantId)
  const { data: u } = await db.from('usuarios').select('email, nombre').eq('id', sesion.usuarioId).maybeSingle()
  const usuario = u as { email: string; nombre: string | null } | null

  const negocio = await obtenerNegocio(sesion.tenantId)
  const lim = await estadoLimiteMensajes(sesion.tenantId, row.plan, row.sub_estado)

  return NextResponse.json({
    nombre: row.nombre ?? null,
    plan: row.plan,
    sub_estado: row.sub_estado,
    sub_proximo_cobro: row.sub_proximo_cobro,
    trial_fin: row.trial_fin,
    nombreBot: perfil.nombreBot ?? null,
    email: usuario?.email ?? null,
    usuarioNombre: usuario?.nombre ?? null,
    rol: sesion.rol,
    permisos: negocio.permisos_asesor ?? null,
    consumoMes: { mensajes: lim.usados, limite: lim.limite },
    limiteExcedido: lim.excedido,
  })
}
