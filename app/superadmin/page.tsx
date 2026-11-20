'use client'
import { useEffect, useState } from 'react'
import { conBase } from '@/lib/base'
import { PLANES } from '@/lib/core/plataforma'
import type { TenantMetricas } from '@/lib/core/plataforma'
import type { ResumenPlataforma } from '@/lib/core/monitoreo'
import type { PlataformaEvento } from '@/lib/core/eventos'
import { DetalleDrawer } from './detalle-drawer'

// ─── Tipos locales ────────────────────────────────────────────────────────────

type CrearForm = {
  nombre: string
  rubro: string
  email: string
  password: string
}

// ─── Helpers (fuera del componente raíz) ─────────────────────────────────────

function formatFecha(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function formatTokens(n: number): string {
  if (!n) return '0'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatFechaHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-PE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const EVENTO_META: Record<string, { icono: string; texto: string }> = {
  tenant_creado: { icono: '🆕', texto: 'Nuevo inquilino' },
  whatsapp_conectado: { icono: '📱', texto: 'WhatsApp conectado' },
}

function NovedadesPanel({ eventos }: { eventos: PlataformaEvento[] }) {
  if (eventos.length === 0) return null
  return (
    <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Novedades</p>
      <ul className="space-y-1.5">
        {eventos.map((ev) => {
          const meta = EVENTO_META[ev.tipo] ?? { icono: '•', texto: ev.tipo }
          const nombre = typeof ev.detalle?.nombre === 'string' ? ev.detalle.nombre : null
          const email = typeof ev.detalle?.email === 'string' ? ev.detalle.email : null
          return (
            <li key={ev.id} className="flex items-center gap-2 text-sm text-zinc-300">
              <span className="text-base leading-none">{meta.icono}</span>
              <span className="font-medium text-zinc-100">{meta.texto}</span>
              {nombre && <span className="text-zinc-400">· {nombre}</span>}
              {!nombre && ev.tenant_id != null && <span className="text-zinc-500">· tenant {ev.tenant_id}</span>}
              {email && <span className="text-zinc-600">({email})</span>}
              <span className="ml-auto text-xs text-zinc-600">{formatFechaHora(ev.created_at)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Sub-componentes (fuera de la función principal) ─────────────────────────

function BadgeEstado({ estado }: { estado: string }) {
  const activo = estado === 'activo'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        activo
          ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-red-500/15 text-red-400'
      }`}
    >
      {activo ? 'activo' : 'suspendido'}
    </span>
  )
}

function BadgeCanal({ canal }: { canal: TenantMetricas['canal'] }) {
  if (canal === 'conectado') {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/15 text-emerald-400">
        conectado
      </span>
    )
  }
  if (canal === 'desconectado') {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-red-500/15 text-red-400">
        desconectado
      </span>
    )
  }
  return <span className="text-zinc-600 text-sm">—</span>
}

function FilaTenant({
  tenant,
  onAccion,
  onVer,
}: {
  tenant: TenantMetricas
  onAccion: () => void
  onVer: () => void
}) {
  const [accionando, setAccionando] = useState(false)

  async function toggleEstado() {
    setAccionando(true)
    const nuevo = tenant.estado === 'activo' ? 'suspendido' : 'activo'
    await fetch(conBase('/api/superadmin/tenants'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: tenant.id, estado: nuevo }),
    })
    setAccionando(false)
    onAccion()
  }

  async function cambiarPlan(plan: string) {
    await fetch(conBase('/api/superadmin/tenants'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: tenant.id, plan }),
    })
    onAccion()
  }

  async function cambiarVentana(valor: string) {
    // vacío = volver al default (null); si no, número (el backend hace clamp 6–60)
    const ventana_turnos = valor.trim() === '' ? null : Number(valor)
    if (ventana_turnos !== null && !Number.isFinite(ventana_turnos)) return
    await fetch(conBase('/api/superadmin/tenants'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: tenant.id, ventana_turnos }),
    })
    onAccion()
  }

  async function impersonar() {
    setAccionando(true)
    await fetch(conBase('/api/superadmin/impersonar'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id }),
    })
    window.location.href = conBase('/')
  }

  return (
    <tr className="border-t border-zinc-800 hover:bg-zinc-800/30">
      <td className="px-4 py-3">
        <button onClick={onVer} className="text-left font-semibold text-zinc-100 underline-offset-2 hover:text-white hover:underline" title="Ver ficha completa">{tenant.nombre}</button>
        <p className="text-xs text-zinc-500">{tenant.slug}</p>
        <p className="text-xs text-zinc-600">{formatFecha(tenant.created_at)}</p>
      </td>
      <td className="px-4 py-3">
        <BadgeEstado estado={tenant.estado} />
      </td>
      <td className="px-4 py-3">
        <select
          value={tenant.plan}
          onChange={(e) => cambiarPlan(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          {Object.entries(PLANES).map(([key, val]) => (
            <option key={key} value={key}>
              {val.nombre}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 text-center text-sm text-zinc-300">{tenant.usuarios}</td>
      <td className="px-4 py-3 text-center text-sm text-zinc-300">{tenant.mensajes}</td>
      <td className="px-4 py-3 text-center text-sm text-zinc-300">{tenant.pedidos}</td>
      <td className="px-4 py-3 text-center text-sm text-zinc-300">{tenant.productos}</td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm text-zinc-300">
          {tenant.consumoMes?.mensajes?.toLocaleString('es-PE') ?? '—'}
        </span>
        {tenant.limiteExcedido && (
          <span className="ml-1.5 inline-flex items-center rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
            límite
          </span>
        )}
        <p className="mt-0.5 text-[10px] text-zinc-600">
          {formatTokens(tenant.consumoMes?.tokens_llm ?? 0)} tok · {tenant.consumoMes?.segundos_voz ?? 0}s voz
        </p>
      </td>
      <td className="px-4 py-3 text-xs text-zinc-500">{formatFecha(tenant.ultima_actividad)}</td>
      <td className="px-4 py-3 text-center">
        <BadgeCanal canal={tenant.canal} />
      </td>
      <td className="px-4 py-3 text-center text-sm text-zinc-300">
        {Math.round((tenant.conversion ?? 0) * 100)}%
      </td>
      <td className="px-4 py-3 text-center text-sm text-zinc-300">{tenant.cierres}</td>
      <td className="px-4 py-3 text-center">
        <input
          type="number"
          min={6}
          max={60}
          defaultValue={tenant.ventana_turnos ?? ''}
          placeholder="20"
          title="Turnos textuales que ve el bot (vacío = 20 por defecto, 6–60)"
          onBlur={(e) => {
            const actual = tenant.ventana_turnos ?? ''
            if (String(e.target.value) !== String(actual)) cambiarVentana(e.target.value)
          }}
          className="w-16 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-center text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button
            onClick={toggleEstado}
            disabled={accionando}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition disabled:opacity-40 ${
              tenant.estado === 'activo'
                ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
            }`}
          >
            {tenant.estado === 'activo' ? 'Suspender' : 'Activar'}
          </button>
          <button
            onClick={impersonar}
            disabled={accionando}
            className="rounded-lg bg-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-600 disabled:opacity-40"
          >
            Entrar como
          </button>
        </div>
      </td>
    </tr>
  )
}

function ModalCrear({
  onCreado,
  onCerrar,
}: {
  onCreado: () => void
  onCerrar: () => void
}) {
  const [form, setForm] = useState<CrearForm>({
    nombre: '',
    rubro: '',
    email: '',
    password: '',
  })
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<{ tenantId: number; widgetKey: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function actualizarCampo(campo: keyof CrearForm, valor: string) {
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    if (cargando) return
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(conBase('/api/superadmin/tenants'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const data = await res.json()
        setResultado(data)
        onCreado()
      } else {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Error al crear el inquilino')
      }
    } catch {
      setError('No se pudo conectar')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-zinc-100">Crear inquilino</h2>

        {resultado ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-emerald-400 font-semibold">¡Inquilino creado correctamente!</p>
            <div className="rounded-lg bg-zinc-800 p-3">
              <p className="text-xs text-zinc-400 mb-1">Tenant ID</p>
              <p className="font-mono text-sm text-zinc-100">{resultado.tenantId}</p>
            </div>
            <div className="rounded-lg bg-zinc-800 p-3">
              <p className="text-xs text-zinc-400 mb-1">Widget Key</p>
              <p className="font-mono text-sm break-all text-zinc-100">{resultado.widgetKey}</p>
            </div>
            <button
              onClick={onCerrar}
              className="mt-2 w-full rounded-xl bg-zinc-700 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-600"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={crear} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Nombre
              </label>
              <input
                type="text"
                required
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20"
                value={form.nombre}
                onChange={(e) => actualizarCampo('nombre', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Rubro
              </label>
              <input
                type="text"
                required
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20"
                value={form.rubro}
                onChange={(e) => actualizarCampo('rubro', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Email admin
              </label>
              <input
                type="email"
                required
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20"
                value={form.email}
                onChange={(e) => actualizarCampo('email', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Contraseña admin
              </label>
              <input
                type="password"
                required
                minLength={8}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20"
                value={form.password}
                onChange={(e) => actualizarCampo('password', e.target.value)}
              />
            </div>

            {error && <p className="text-sm font-semibold text-red-400">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onCerrar}
                className="flex-1 rounded-xl border border-zinc-700 py-2 text-sm font-semibold text-zinc-400 hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={cargando}
                className="flex-1 rounded-xl bg-zinc-700 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-600 disabled:opacity-50"
              >
                {cargando ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SuperadminConsola() {
  const [tenants, setTenants] = useState<TenantMetricas[]>([])
  const [resumen, setResumen] = useState<ResumenPlataforma | null>(null)
  const [eventos, setEventos] = useState<PlataformaEvento[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalCrear, setModalCrear] = useState(false)
  const [detalle, setDetalle] = useState<TenantMetricas | null>(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(conBase('/api/superadmin/tenants'))
      if (res.ok) {
        const data = await res.json()
        setTenants(data.tenants ?? [])
        setResumen(data.resumen ?? null)
        setEventos(data.eventos ?? [])
      } else {
        setError('No se pudo cargar la lista de inquilinos')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(cargar, 0)
    return () => clearTimeout(t)
  }, [])

  async function salir() {
    await fetch(conBase('/api/superadmin/logout'), { method: 'POST' })
    window.location.href = conBase('/superadmin/login')
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {modalCrear && (
        <ModalCrear
          onCreado={cargar}
          onCerrar={() => setModalCrear(false)}
        />
      )}

      {detalle && <DetalleDrawer tenant={detalle} onCerrar={() => setDetalle(null)} />}

      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              vende-ia · plataforma
            </p>
            <h1 className="text-xl font-semibold text-zinc-100">Consola super-admin</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setModalCrear(true)}
              className="rounded-xl bg-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-600"
            >
              + Crear inquilino
            </button>
            <button
              onClick={salir}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-400 transition hover:bg-zinc-800"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Novedades (altas, conexiones de WhatsApp) */}
        <NovedadesPanel eventos={eventos} />

        {/* Tarjetas resumen */}
        {resumen && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tenants activos</p>
              <p className="mt-1 text-xl font-semibold text-zinc-100">
                {resumen.tenants_activos}
                <span className="ml-1 text-sm font-normal text-zinc-500">/ {resumen.tenants_total}</span>
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Mensajes mes</p>
              <p className="mt-1 text-xl font-semibold text-zinc-100">
                {resumen.mensajes_mes_total.toLocaleString('es-PE')}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Límite excedido</p>
              <p className={`mt-1 text-xl font-semibold ${resumen.limite_excedido_total > 0 ? 'text-red-400' : 'text-zinc-100'}`}>
                {resumen.limite_excedido_total}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">WhatsApp</p>
              <p className={`mt-1 text-xl font-semibold ${resumen.worker_caido ? 'text-red-400' : 'text-zinc-100'}`}>
                {resumen.worker_caido
                  ? 'worker caído'
                  : `${resumen.wa_conectados}/${resumen.wa_total}`}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Ingreso potencial</p>
              <p className="mt-1 text-xl font-semibold text-zinc-100">
                S/ {resumen.ingreso_potencial_pen.toLocaleString('es-PE')}
              </p>
            </div>
          </div>
        )}

        {cargando && (
          <p className="py-16 text-center text-sm text-zinc-500">Cargando inquilinos…</p>
        )}

        {error && !cargando && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
            <button onClick={cargar} className="ml-3 underline hover:no-underline">
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !error && tenants.length === 0 && (
          <p className="py-16 text-center text-sm text-zinc-500">
            No hay inquilinos registrados aún.
          </p>
        )}

        {!cargando && !error && tenants.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Inquilino
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Plan
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Usuarios
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Mensajes
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Pedidos
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Productos
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Consumo (mes)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Últ. actividad
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    WhatsApp
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Conversión
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Cierres
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Memoria · turnos
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <FilaTenant key={t.id} tenant={t} onAccion={cargar} onVer={() => setDetalle(t)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
