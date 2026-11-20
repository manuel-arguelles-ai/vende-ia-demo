// app/api/realtime-token/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sesionValida, COOKIE_SESION } from '@/lib/sesion'
import { firmarSupabaseJwt } from '@/lib/supabase-jwt'

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies()
  const tokenSesion = cookieStore.get(COOKIE_SESION)?.value
  const sesion = await sesionValida(tokenSesion, process.env.AUTH_SECRET)
  if (!sesion) {
    return NextResponse.json({}, { status: 401 })
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET
  if (!jwtSecret) {
    // No bloquear: devolver 503 con body descriptivo
    return NextResponse.json(
      { error: 'SUPABASE_JWT_SECRET not configured' },
      { status: 503 },
    )
  }

  const token = await firmarSupabaseJwt(sesion.tenantId, sesion.usuarioId, jwtSecret)
  return NextResponse.json({ token })
}
