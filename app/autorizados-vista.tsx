'use client'
import { useEffect, useState } from 'react'
import { Users, ShieldCheck, Info } from 'lucide-react'
import type { DatosNegocio } from '@/lib/core/negocio'
import { conBase } from '@/lib/base'
import { useConfirm } from './confirm'
import { useToast } from './toast'
import { telefonoLead } from '@/lib/ui/lead'
import { RadioGrupo, ColumnasConfig } from './config-ui'

type Autorizado = { numero: string; etiqueta: string | null; created_at: string }

export function AutorizadosVista({
  negocio,
  setNegocio,
}: {
  negocio: DatosNegocio
  setNegocio: (n: DatosNegocio) => void
}) {
  const [lista, setLista] = useState<Autorizado[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [numero, setNumero] = useState('')
  const [etiqueta, setEtiqueta] = useState('')
  const [agregando, setAgregando] = useState(false)
  const [guardandoToggle, setGuardandoToggle] = useState(false)
  const confirm = useConfirm()
  const toast = useToast()

  async function cargarLista() {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(conBase('/api/autorizados'))
      if (!res.ok) throw new Error('Error al cargar la lista')
      setLista(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(cargarLista, 0) // carga inicial diferida (lint de pureza)
    return () => clearTimeout(t)
  }, [])

  async function toggleAllowlist(activo: boolean) {
    const nuevo = { ...negocio, allowlist_activo: activo }
    setNegocio(nuevo)
    setGuardandoToggle(true)
    try {
      await fetch(conBase('/api/negocio'), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(nuevo),
      })
      toast.ok(activo ? 'Modo «Solo números autorizados» activado' : 'Modo «Responder a todos» activado')
    } finally {
      setGuardandoToggle(false)
    }
  }

  async function agregar() {
    if (!numero.trim()) { setError('Escribe el número a autorizar'); return }
    setAgregando(true)
    setError(null)
    try {
      const res = await fetch(conBase('/api/autorizados'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ numero: numero.trim(), etiqueta: etiqueta.trim() || undefined }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Error al agregar')
      }
      setNumero('')
      setEtiqueta('')
      await cargarLista()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setAgregando(false)
    }
  }

  async function quitar(num: string) {
    const ok = await confirm({
      titulo: 'Quitar número autorizado',
      mensaje: `El número ${num} dejará de poder hablar con el agente en modo demo.`,
      confirmar: 'Quitar',
      peligro: true,
    })
    if (!ok) return
    setError(null)
    try {
      const res = await fetch(conBase('/api/autorizados'), {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ numero: num }),
      })
      if (!res.ok) throw new Error('Error al quitar el número')
      await cargarLista()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  const activo = negocio.allowlist_activo ?? false

  return (
    <div className="w-full max-w-[1600px]">
      <ColumnasConfig
        izquierda={<>
      {/* Toggle allowlist */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <RadioGrupo
          label="Modo demo (allowlist)"
          ariaLabel="Modo demo"
          value={activo}
          onChange={(v) => void toggleAllowlist(v)}
          disabled={guardandoToggle}
          opciones={[
            { value: false, titulo: 'Responder a todos', desc: 'El agente atiende a cualquier número que escriba (modo normal).', icono: Users },
            { value: true, titulo: 'Solo números autorizados', desc: 'El agente responde únicamente a la lista de abajo. El resto queda registrado en el CRM sin respuesta.', icono: ShieldCheck },
          ]}
        />
      </div>
        </>}
        derecha={<>
      {/* Lista de números autorizados */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Números autorizados
        </label>

        {!activo && (
          <p className="mt-2 flex items-start gap-2 rounded-lg bg-[#E6FBFD] px-3 py-2 text-xs text-[#0E7490]">
            <Info size={14} strokeWidth={1.75} aria-hidden className="mt-0.5 flex-shrink-0" />
            Esta lista solo se usa en modo «Solo números autorizados». Cambia el modo arriba para activarla.
          </p>
        )}

        {/* Formulario agregar (deshabilitado por control, no por opacity global) */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            disabled={!activo}
            className="flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20 disabled:cursor-not-allowed disabled:bg-[#f9fafb] disabled:text-muted"
            placeholder="Número (ej: 51987654321)"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void agregar()
            }}
          />
          <input
            disabled={!activo}
            className="flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20 disabled:cursor-not-allowed disabled:bg-[#f9fafb] disabled:text-muted"
            placeholder="Etiqueta (opcional)"
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void agregar()
            }}
          />
          <button
            type="button"
            onClick={() => void agregar()}
            disabled={agregando || !activo}
            className="rounded-xl bg-coral px-5 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#f9fafb] disabled:text-muted"
          >
            {agregando ? 'Agregando…' : 'Agregar'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="mt-2 text-xs font-semibold text-coral">{error}</p>
        )}

        {/* Lista (siempre legible; solo se deshabilitan los controles de arriba) */}
        <div className="mt-3 space-y-1">
          {cargando && (
            <p className="text-xs text-muted">Cargando…</p>
          )}
          {!cargando && lista.length === 0 && (
            <p className="text-xs text-muted">
              Sin números autorizados. Agrega al menos uno para activar el modo demo.
            </p>
          )}
          {lista.map((item) => (
            <div
              key={item.numero}
              className="flex items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2"
            >
              <div className="min-w-0">
                <span className="block text-sm font-semibold">{telefonoLead(item.numero)}</span>
                {item.etiqueta && (
                  <span className="block text-[11px] text-muted">{item.etiqueta}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => void quitar(item.numero)}
                title="Quitar"
                className="flex-shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-muted transition hover:bg-coral-soft hover:text-coral"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      </div>
        </>}
      />
    </div>
  )
}
