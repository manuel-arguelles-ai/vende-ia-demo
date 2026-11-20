'use client'
import type { LucideIcon } from 'lucide-react'

// Componentes compartidos por las vistas de configuración (Mi negocio, Mi Agente):
// tarjeta de sección con header, barra de guardado sticky con dirty state y toggle.

// Chip del icono por tono (tint suave de fondo + icono de línea coloreado, como
// los KPIs; nunca relleno sólido). El texto no cambia de color.
export type SeccionTone = 'cyan' | 'blue' | 'green' | 'purple' | 'amber'
const TONE: Record<SeccionTone, { bg: string; fg: string }> = {
  cyan: { bg: '#CFFAFE', fg: '#0891B2' },
  blue: { bg: '#E6F1FB', fg: '#185FA5' },
  green: { bg: '#E1F5EE', fg: '#0F6E56' },
  purple: { bg: '#EEEDFE', fg: '#3C3489' },
  amber: { bg: '#FAEEDA', fg: '#854F0B' },
}

// Tarjeta de sección con header propio (16px/500 + subtexto muted + chip de icono),
// distinto de los labels de campo (11px uppercase muted).
export function Seccion({ icono: Icono, titulo, sub, wide, className, tone = 'cyan', children }: { icono: LucideIcon; titulo: string; sub?: string; wide?: boolean; className?: string; tone?: SeccionTone; children: React.ReactNode }) {
  const c = TONE[tone]
  return (
    <section className={`rounded-xl border-[0.5px] border-[#f0f0f3] bg-card p-5 shadow-[0_1px_2px_rgba(33,31,26,0.04)] ${wide ? 'lg:col-span-2' : ''} ${className ?? ''}`}>
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg" style={{ background: c.bg, color: c.fg }}>
          <Icono size={17} strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-medium text-ink">{titulo}</h2>
          {sub && <p className="text-xs text-muted">{sub}</p>}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

// Layout de config: dos columnas flex (cada una empaqueta sus cards con gap,
// sin huecos internos; pueden terminar a distinta altura) + secciones wide
// apiladas a ancho completo debajo. Colapsa a 1 columna en < lg.
export function ColumnasConfig({ izquierda, derecha, wide }: { izquierda: React.ReactNode; derecha: React.ReactNode; wide?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">{izquierda}</div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">{derecha}</div>
      </div>
      {wide}
    </div>
  )
}

// Barra de guardado sticky: aparece solo cuando hay cambios sin guardar.
export function SaveBar({ dirty, guardando, onGuardar, onDescartar }: { dirty: boolean; guardando: boolean; onGuardar: () => void; onDescartar: () => void }) {
  if (!dirty) return null
  return (
    <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card/95 px-4 py-3 shadow-[0_-2px_12px_rgba(33,31,26,0.08)] backdrop-blur">
      <span className="text-sm font-medium text-ink">Tienes cambios sin guardar</span>
      <span className="flex gap-2">
        <button
          onClick={onDescartar}
          disabled={guardando}
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:text-ink disabled:opacity-50"
        >
          Descartar
        </button>
        <button
          onClick={onGuardar}
          disabled={guardando}
          className="rounded-full bg-coral px-5 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </span>
    </div>
  )
}

// Radio-card compartida: card blanca con radio real (anillo/punto), borde cian
// 2px en la activa, ícono opcional en cuadrito de color. Sin bullet de texto.
// Accesible (radiogroup/radio, teclado, foco visible).
export type RadioOpcion<T> = { value: T; titulo: string; desc?: string; icono?: LucideIcon }
export function RadioGrupo<T extends string | number | boolean>({
  label,
  ariaLabel,
  value,
  onChange,
  opciones,
  disabled,
}: {
  label?: string
  ariaLabel?: string
  value: T
  onChange: (v: T) => void
  opciones: RadioOpcion<T>[]
  disabled?: boolean
}) {
  return (
    <div>
      {label && <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>}
      <div role="radiogroup" aria-label={ariaLabel ?? label} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {opciones.map((o) => {
          const activa = value === o.value
          const Icono = o.icono
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={activa}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              className={`flex items-start gap-3 rounded-xl p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-coral disabled:cursor-not-allowed disabled:opacity-60 ${
                activa ? 'border-2 border-coral bg-[#f7feff]' : 'border-[0.5px] border-[#f0f0f3] bg-card hover:border-[#cfd0da]'
              }`}
            >
              {Icono && (
                <span className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg ${activa ? 'bg-coral-soft text-[#0891B2]' : 'bg-[#f5f5fa] text-muted'}`}>
                  <Icono size={17} strokeWidth={1.75} aria-hidden />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{o.titulo}</span>
                {o.desc && <span className="mt-0.5 block text-[11px] text-muted">{o.desc}</span>}
              </span>
              <span aria-hidden className={`mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full border-2 ${activa ? 'border-coral' : 'border-[#d4d4de]'}`}>
                {activa && <span className="h-1.5 w-1.5 rounded-full bg-coral" />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Switch/toggle coherente con los controles del CRM (reemplaza checkboxes nativos).
export function Toggle({ checked, onChange, ariaLabel }: { checked: boolean; onChange: (v: boolean) => void; ariaLabel?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-coral ${checked ? 'bg-coral' : 'bg-line'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}
