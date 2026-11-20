'use client'
import { useState } from 'react'
import { conBase } from '@/lib/base'
import { CampoLinea, PanelIlustracion, IconoMail } from '../auth-ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    if (cargando) return
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(conBase('/api/login'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        window.location.href = conBase('/')
      } else {
        setError('Credenciales inválidas')
      }
    } catch {
      setError('No se pudo conectar')
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className="relative z-10 grid min-h-screen lg:grid-cols-2">
      {/* Formulario (izquierda) */}
      <div className="flex items-center justify-center px-6 py-10 sm:px-10">
        <form onSubmit={entrar} className="anim-subir w-full max-w-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-coral">vende-ia</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">CRM en vivo</h1>
          <p className="mt-1.5 text-sm text-muted">Acceso para el equipo de ventas</p>

          <div className="mt-8">
            <CampoLinea
              id="email"
              label="Correo"
              type="email"
              icono={<IconoMail />}
              autoComplete="username"
              required
              value={email}
              onChange={setEmail}
            />
            <CampoLinea
              id="password"
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={setPassword}
            />
          </div>

          {error && <p className="mt-4 text-sm font-semibold text-coral">{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="mt-8 w-full rounded-xl bg-coral py-3 text-sm font-bold text-white shadow-[0_6px_18px_rgba(224,99,63,0.25)] transition hover:brightness-95 disabled:opacity-50"
          >
            {cargando ? 'Entrando…' : 'Entrar'}
          </button>

          <p className="mt-6 text-center text-sm text-muted">
            ¿No tienes cuenta?{' '}
            <a href={conBase('/registro')} className="font-semibold text-coral underline-offset-2 hover:underline">
              Crea tu negocio
            </a>
          </p>
        </form>
      </div>

      {/* Ilustración (derecha) */}
      <PanelIlustracion
        titulo="Cada chat de WhatsApp, ordenado y listo para vender."
        subtitulo="Leads calificados por IA, en vivo."
      />
    </main>
  )
}
