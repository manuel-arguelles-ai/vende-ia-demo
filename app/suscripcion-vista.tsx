'use client'
import { useEffect, useState } from 'react'
import { Check, Sprout, Rocket, Crown, Building2, type LucideIcon } from 'lucide-react'
import { conBase } from '@/lib/base'
import { PLANES } from '@/lib/core/plataforma'

// Identidad por tier (SOLO en esta vista de marketing; no propagar a la app).
type Tier = { icon: LucideIcon; iconBg: string; iconFg: string }
const TIER: Record<string, Tier> = {
  free: { icon: Sprout, iconBg: '#F1EFE8', iconFg: '#8B897F' },
  pro: { icon: Rocket, iconBg: '#CFFAFE', iconFg: '#0891B2' },
  max: { icon: Crown, iconBg: '#CFFAFE', iconFg: '#0E7490' },
  enterprise: { icon: Building2, iconBg: 'rgba(255,255,255,0.2)', iconFg: '#FFFFFF' },
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type MiPlan = {
  plan: string
  sub_estado: string | null
  sub_proximo_cobro: string | null
  trial_fin: string | null
  consumoMes?: { mensajes: number; limite: number | null }
  limiteExcedido?: boolean
}

// ─── Helpers (fuera del componente) ──────────────────────────────────────────

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

function BadgeSubEstado({ estado }: { estado: string | null }) {
  if (!estado || estado === 'none') return null

  const MAP: Record<string, { label: string; cls: string }> = {
    trial:      { label: 'Prueba gratuita', cls: 'bg-amber-500/15 text-amber-400' },
    authorized: { label: 'Activo',          cls: 'bg-sage-soft text-sage' },
    paused:     { label: 'Pausado',         cls: 'bg-[var(--tibio)]/30 text-[var(--tibio)]' },
    cancelled:  { label: 'Cancelado',       cls: 'bg-coral-soft text-coral' },
  }

  const badge = MAP[estado] ?? { label: estado, cls: 'bg-paper-2 text-muted' }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.cls}`}
    >
      {badge.label}
    </span>
  )
}

// ─── Tarjeta de plan ──────────────────────────────────────────────────────────

function TarjetaPlan({
  planKey,
  planActual,
  cargandoUpgrade,
  onUpgrade,
}: {
  planKey: string
  planActual: string
  cargandoUpgrade: string | null
  onUpgrade: (plan: string) => void
}) {
  const info = PLANES[planKey as keyof typeof PLANES]
  if (!info) return null

  const esActual = planKey === planActual
  const esEnterprise = planKey === 'enterprise'
  const esPago = 'pago' in info && info.pago

  const FEATURES: Record<string, string[]> = {
    free:       ['Hasta 1.000 mensajes/mes', 'CRM básico', 'Pipeline de ventas', 'Catálogo de productos'],
    pro:        ['Hasta 20.000 mensajes/mes', 'CRM completo', 'Pipeline de ventas', 'Copiloto IA', 'Exportar CSV', 'Soporte prioritario'],
    max:        ['Hasta 100.000 mensajes/mes', 'Todo lo de Pro', 'Multi-agente', 'Analítica avanzada', 'SLA garantizado'],
    enterprise: ['Mensajes ilimitados', 'Onboarding dedicado', 'Integración a medida', 'Contrato personalizado'],
  }

  const features = FEATURES[planKey] ?? []
  const puedeUpgrade = esPago && !esActual && planActual !== 'enterprise'

  const tier = TIER[planKey] ?? TIER.free
  const Icono = tier.icon
  const dark = esEnterprise // Enterprise: única card premium con gradiente
  const check = dark ? '#FFFFFF' : '#0891B2'
  const textoMuted = dark ? 'text-white/75' : 'text-muted'

  // Un solo protagonista (Enterprise, gradiente violeta). Free/Pro/Max: claras
  // uniformes (mismo lienzo blanco + borde neutro), diferenciadas solo por el ícono.
  const base = 'relative flex h-full flex-col rounded-[14px] border-[0.5px] p-4 transition'
  const cardCls = dark ? `${base} border-transparent text-white` : `${base} border-[#f0f0f3] bg-card hover:border-muted`
  const cardStyle: React.CSSProperties = dark
    ? { background: 'linear-gradient(158deg,#0BA5C0,#0E7490)', boxShadow: '0 10px 28px rgba(14,116,144,0.28)' }
    : {}

  return (
    <div className={cardCls} style={cardStyle}>
      {/* Header: icono por tier + badge (Plan actual / Premium) */}
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full" style={{ background: tier.iconBg, color: tier.iconFg }}>
          <Icono size={20} strokeWidth={1.75} aria-hidden />
        </span>
        {esActual ? (
          <span className="flex-shrink-0 rounded-full bg-coral-soft px-2.5 py-0.5 text-[11px] font-bold text-[#0E7490]">
            Plan actual
          </span>
        ) : dark ? (
          <span className="flex-shrink-0 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white">
            Premium
          </span>
        ) : null}
      </div>

      {/* Nombre + precio */}
      <div className="mt-3">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${textoMuted}`}>{info.nombre}</p>
        {info.precio_pen > 0 ? (
          <p className={`mt-0.5 font-display text-2xl font-bold ${dark ? 'text-white' : ''}`}>
            S/{info.precio_pen}
            <span className={`ml-1 text-sm font-normal ${textoMuted}`}>/mes</span>
          </p>
        ) : esEnterprise ? (
          <p className="mt-0.5 font-display text-2xl font-bold text-white">A medida</p>
        ) : (
          <p className="mt-0.5 font-display text-2xl font-bold">Gratis</p>
        )}
      </div>

      {/* Features (checks cian; blanco en la card premium) */}
      <ul className="mt-4 flex-1 space-y-1.5">
        {features.map((f) => (
          <li key={f} className={`flex items-start gap-1.5 text-sm ${dark ? 'text-white/85' : 'text-muted'}`}>
            <Check size={15} strokeWidth={2.5} aria-hidden className="mt-0.5 flex-shrink-0" style={{ color: check }} />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA anclado al fondo */}
      <div className="mt-5">
        {esActual ? (
          <div className={`flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold ${textoMuted}`}>
            <Check size={16} strokeWidth={2} aria-hidden /> Plan en uso
          </div>
        ) : puedeUpgrade ? (
          <button
            type="button"
            onClick={() => onUpgrade(planKey)}
            disabled={cargandoUpgrade !== null}
            className="w-full rounded-xl bg-coral px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-50"
          >
            {cargandoUpgrade === planKey ? 'Redirigiendo…' : `Mejorar a ${info.nombre} — S/${info.precio_pen}/mes`}
          </button>
        ) : esEnterprise ? (
          <a
            href="mailto:hola@example.com?subject=vende-ia Enterprise"
            className="block w-full rounded-xl bg-white px-4 py-2.5 text-center text-sm font-bold text-[#0E7490] transition hover:bg-white/90"
          >
            Contáctanos
          </a>
        ) : (
          <div className="rounded-xl border border-line px-3 py-2 text-center text-xs text-muted">
            Incluido
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vista principal ──────────────────────────────────────────────────────────

export function SuscripcionVista() {
  const [datos, setDatos] = useState<MiPlan | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cargandoUpgrade, setCargandoUpgrade] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setCargando(true)
      setError(null)
      fetch(conBase('/api/mi-plan'))
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Error al cargar el plan'))))
        .then((json: MiPlan) => setDatos(json))
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error desconocido'))
        .finally(() => setCargando(false))
    }, 0)
    return () => clearTimeout(t)
  }, [])

  async function upgrade(plan: string) {
    setCargandoUpgrade(plan)
    try {
      const res = await fetch(conBase('/api/suscripcion'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Error al iniciar suscripción')
      }
      const data = (await res.json()) as { init_point: string }
      window.location.href = data.init_point
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al redirigir')
      setCargandoUpgrade(null)
    }
  }

  if (cargando) {
    return (
      <div className="max-w-4xl">
        <p className="text-sm text-muted">Cargando plan…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl">
        <div className="rounded-xl border border-coral/40 bg-coral-soft px-4 py-3 text-sm font-semibold text-coral">
          {error}
        </div>
      </div>
    )
  }

  const planActual = datos?.plan ?? 'free'
  const subEstado = datos?.sub_estado ?? null

  return (
    <div className="max-w-4xl space-y-6">
      {/* Estado actual (hero sutil) */}
      <div className="rounded-2xl border border-[#cfeef4] bg-gradient-to-br from-[#f0fcfd] via-white to-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Tu suscripción</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-display text-lg font-semibold capitalize">
            {PLANES[planActual as keyof typeof PLANES]?.nombre ?? planActual}
          </span>
          <BadgeSubEstado estado={subEstado} />
        </div>

        {subEstado === 'trial' && datos?.trial_fin && (
          <p className="mt-2 text-sm text-muted">
            Prueba gratuita hasta el{' '}
            <span className="font-semibold text-ink">{formatFecha(datos.trial_fin)}</span>
          </p>
        )}
        {subEstado === 'authorized' && datos?.sub_proximo_cobro && (
          <p className="mt-2 text-sm text-muted">
            Próximo cobro el{' '}
            <span className="font-semibold text-ink">{formatFecha(datos.sub_proximo_cobro)}</span>
          </p>
        )}
        {subEstado === 'paused' && (
          <p className="mt-2 text-sm text-muted">
            Tu suscripción está pausada. Mejora tu plan para reactivarla.
          </p>
        )}
        {subEstado === 'cancelled' && (
          <p className="mt-2 text-sm text-muted">
            Suscripción cancelada. Puedes volver a suscribirte en cualquier momento.
          </p>
        )}

        {/* Consumo mensual */}
        {datos?.consumoMes !== undefined && (
          <div className="mt-4">
            {(() => {
              const m = datos.consumoMes!.mensajes
              const lim = datos.consumoMes!.limite
              const pct = lim ? Math.min(100, Math.round((m / lim) * 100)) : 0
              const color = pct >= 90 ? '#d6502e' : pct >= 75 ? '#d29a3a' : '#17a877'
              return (
                <>
                  <div className="flex items-end justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Mensajes este mes</p>
                    {lim !== null && <span className="text-xs font-semibold" style={{ color }}>{pct}% usado</span>}
                  </div>
                  <p className="mt-1 font-display text-2xl font-bold leading-none text-ink">
                    {m.toLocaleString('es-PE')}
                    <span className="ml-1 text-sm font-normal text-muted">/ {lim !== null ? lim.toLocaleString('es-PE') : '∞'}</span>
                  </p>
                  {lim !== null && (
                    <>
                      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-paper-2">
                        <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <p className="mt-1 text-xs text-muted">Quedan {Math.max(0, lim - m).toLocaleString('es-PE')} mensajes</p>
                    </>
                  )}
                </>
              )
            })()}
            {datos.limiteExcedido && planActual === 'free' && (
              <div className="mt-2 rounded-xl border border-coral/40 bg-coral-soft px-3 py-2 text-xs font-semibold text-coral">
                Alcanzaste el límite — tu agente se pausa hasta el próximo mes o al mejorar el plan.
              </div>
            )}
            {datos.limiteExcedido && planActual !== 'free' && (
              <div className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-400">
                Superaste tu plan — considera mejorar tu plan.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tarjetas de planes */}
      <div>
        <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-muted">Planes disponibles</p>
        <div className="grid grid-cols-1 gap-4 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.keys(PLANES).map((key) => (
            <TarjetaPlan
              key={key}
              planKey={key}
              planActual={planActual}
              cargandoUpgrade={cargandoUpgrade}
              onUpgrade={upgrade}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
