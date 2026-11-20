'use client'
import { Search, Tag, Trophy, CircleDot, CircleX, List, type LucideIcon } from 'lucide-react'
import type { Filtros, RangoUltima, EstadoVenta } from '@/lib/core/filtros'
import { Select } from './select'

// Barra de filtros del pipeline: búsqueda libre, etiqueta, última comunicación y estado de venta.
const RANGOS: { key: RangoUltima; label: string }[] = [
  { key: null, label: 'Todas' },
  { key: '24h', label: 'Últ. 24h' },
  { key: '3d', label: '3 días' },
  { key: '7d', label: '7 días' },
  { key: 'mas7d', label: '+7d sin contacto' },
]

const ESTADOS: { key: EstadoVenta; label: string; icono: LucideIcon }[] = [
  { key: 'activos', label: 'Activos', icono: CircleDot },
  { key: 'ganados', label: 'Ganados', icono: Trophy },
  { key: 'perdidos', label: 'Perdidos', icono: CircleX },
  { key: 'todos', label: 'Todos', icono: List },
]

// Chips outline: activo = borde cian (sin relleno); inactivo = borde neutro.
function chipCls(activo: boolean) {
  return `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13.5px] font-medium transition ${
    activo ? 'border border-coral text-[#0E7490]' : 'border-[0.5px] border-[#f0f0f3] text-[#8181A5] hover:bg-[#f5f5fa]'
  }`
}

export function FiltrosBar({
  filtros,
  setFiltros,
  etiquetas,
  total,
  visibles,
}: {
  filtros: Filtros
  setFiltros: (f: Filtros) => void
  etiquetas: string[]
  total: number
  visibles: number
}) {
  const activos = Boolean(filtros.q || filtros.etiqueta || filtros.ultima)
  return (
    <div className="space-y-3">
      {/* Fila 1: buscador + etiquetas */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] max-w-[500px] flex-1">
          <Search size={16} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="w-full rounded-full border border-line bg-card py-1.5 pl-9 pr-3.5 text-sm outline-none transition placeholder:text-muted focus:border-coral"
            placeholder="Buscar por número o producto…"
            value={filtros.q ?? ''}
            onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
          />
        </div>
        {etiquetas.length > 0 && (
          <Select
            leadingIcon={Tag}
            ariaLabel="Filtrar por etiqueta"
            value={filtros.etiqueta ?? ''}
            onChange={(v) => setFiltros({ ...filtros, etiqueta: v || null })}
            options={[{ value: '', label: 'todas las etiquetas' }, ...etiquetas.map((e) => ({ value: e, label: e }))]}
          />
        )}
      </div>

      {/* Fila 2: grupos RANGO y ESTADO */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Rango</span>
          <div className="flex flex-wrap gap-1">
            {RANGOS.map((r) => (
              <button key={r.label} onClick={() => setFiltros({ ...filtros, ultima: r.key })} className={chipCls((filtros.ultima ?? null) === r.key)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <span aria-hidden className="h-5 w-px flex-shrink-0 bg-[#f0f0f3]" />

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Estado</span>
          <div className="flex flex-wrap gap-1">
            {ESTADOS.map((e) => {
              const Icono = e.icono
              return (
                <button key={e.key} onClick={() => setFiltros({ ...filtros, estado: e.key })} className={chipCls((filtros.estado ?? 'activos') === e.key)}>
                  <Icono size={14} strokeWidth={1.75} aria-hidden />
                  {e.label}
                </button>
              )
            })}
          </div>
        </div>

        {activos && (
          <span className="text-xs font-semibold text-muted">
            {visibles}/{total} leads ·{' '}
            <button className="text-coral hover:underline" onClick={() => setFiltros({})}>
              limpiar
            </button>
          </span>
        )}
      </div>
    </div>
  )
}
