'use client'
import type { ComponentType } from 'react'

// Tipo de icono aceptado por el sidebar: cubre lucide-react (line icons) y
// react-icons (p. ej. FaWhatsapp), ambos asignables a esta firma mínima.
export type IconoNav = ComponentType<{
  size?: number
  strokeWidth?: number
  className?: string
  'aria-hidden'?: boolean
}>

// Ítem de navegación del sidebar (compartido por la nav principal, WhatsApp,
// Temas y Salir) para un estilo consistente. Soporta:
//  · estado activo (tint + barra de acento + aria-current)
//  · modo rail colapsado (solo desktop): ícono centrado + tooltip accesible
//  · badge numérico y punto de estado sobre el ícono
export function ItemBoton({
  icono: Icono,
  label,
  colapsado,
  activa = false,
  onClick,
  badge,
  puntoEstado,
}: {
  icono: IconoNav
  label: string
  colapsado: boolean
  activa?: boolean
  onClick: () => void
  badge?: number
  puntoEstado?: 'verde' | 'ambar'
}) {
  return (
    <button
      onClick={onClick}
      aria-current={activa ? 'page' : undefined}
      aria-label={label}
      // En el rail colapsado el label se oculta: el title nativo lo muestra al
      // hover sin agregar un elemento que se salga del ancho del rail.
      title={colapsado ? label : undefined}
      className={`group relative flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-coral ${
        activa ? 'bg-coral-soft text-[#0E7490]' : 'text-muted hover:bg-paper hover:text-ink'
      } ${colapsado ? 'lg:justify-center lg:gap-0 lg:px-2' : ''}`}
    >
      {/* Barra de acento del activo (3px) */}
      {activa && (
        <span aria-hidden className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-coral" />
      )}

      {/* Ícono + (opcional) punto de estado / badge-punto en modo rail */}
      <span className="relative flex-shrink-0">
        <Icono size={20} strokeWidth={1.75} aria-hidden />
        {puntoEstado && (
          <span
            aria-hidden
            className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-card ${
              puntoEstado === 'verde' ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
        )}
        {badge != null && badge > 0 && colapsado && (
          <span aria-hidden className="absolute -right-0.5 -top-0.5 hidden h-2 w-2 rounded-full bg-caliente ring-2 ring-card lg:block" />
        )}
      </span>

      {/* Label (oculto en el rail colapsado, solo en desktop) */}
      <span className={`flex-1 truncate text-left ${colapsado ? 'lg:hidden' : ''}`}>{label}</span>

      {/* Badge numérico (visible en modo expandido) */}
      {badge != null && badge > 0 && (
        <span
          className={`ml-auto rounded-full bg-caliente px-1.5 py-0.5 text-[10px] font-bold text-white ${
            colapsado ? 'lg:hidden' : ''
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  )
}
