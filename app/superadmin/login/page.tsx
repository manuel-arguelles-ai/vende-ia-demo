'use client'
import { useState } from 'react'
import { conBase } from '@/lib/base'

export default function SuperadminLogin() {
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
      const res = await fetch(conBase('/api/superadmin/login'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        window.location.href = conBase('/superadmin')
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
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          vende-ia · plataforma
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">
          Consola super-admin
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Acceso exclusivo del administrador de plataforma</p>

        <label className="mt-6 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Correo
        </label>
        <input
          type="email"
          required
          autoComplete="username"
          className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Contraseña
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="mt-3 text-sm font-semibold text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="mt-6 w-full rounded-xl bg-zinc-700 py-2.5 text-sm font-bold text-zinc-100 transition hover:bg-zinc-600 disabled:opacity-50"
        >
          {cargando ? 'Verificando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
