import { NextResponse } from 'next/server'
import { COOKIE_SESION } from '@/lib/sesion'
import { BASE_PATH } from '@/lib/base'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_SESION, '', { path: BASE_PATH, maxAge: 0 })
  return res
}
