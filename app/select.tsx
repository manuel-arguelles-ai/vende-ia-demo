'use client'
import * as RS from '@radix-ui/react-select'
import { Check, ChevronDown, type LucideIcon } from 'lucide-react'

// <Select> compartido (reemplaza los <select> nativos). Panel custom con paleta
// cian, teclado (↑↓/Enter/Esc vía Radix), ARIA y click-outside. La API imita al
// nativo (value/onChange) para migrar sin tocar la lógica.
export type OpcionSelect = { value: string; label: string }

// Radix no permite <Item value="">; mapeamos "" a un centinela interno.
const EMPTY = '__empty__'

export function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
  ariaLabel,
  disabled,
  leadingIcon: Leading,
}: {
  value: string
  onChange: (v: string) => void
  options: OpcionSelect[]
  placeholder?: string
  className?: string
  ariaLabel?: string
  disabled?: boolean
  leadingIcon?: LucideIcon
}) {
  return (
    <RS.Root value={value === '' ? EMPTY : value} onValueChange={(v) => onChange(v === EMPTY ? '' : v)} disabled={disabled}>
      <RS.Trigger
        aria-label={ariaLabel}
        className={`inline-flex h-9 items-center justify-between gap-2 rounded-lg border-[0.5px] border-[#f0f0f3] bg-card px-3 text-sm text-ink outline-none transition data-[state=open]:border-coral focus-visible:border-coral focus-visible:ring-2 focus-visible:ring-coral disabled:opacity-50 ${className ?? ''}`}
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          {Leading && <Leading size={16} strokeWidth={1.75} aria-hidden className="flex-shrink-0 text-muted" />}
          <RS.Value placeholder={placeholder} />
        </span>
        <RS.Icon className="text-muted">
          <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
        </RS.Icon>
      </RS.Trigger>
      <RS.Portal>
        <RS.Content
          position="popper"
          sideOffset={4}
          className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border-[0.5px] border-[#f0f0f3] bg-white p-1 shadow-[0_4px_12px_rgba(16,24,40,0.10)]"
        >
          <RS.Viewport className="max-h-72 overflow-y-auto">
            {options.map((o) => (
              <RS.Item
                key={o.value || EMPTY}
                value={o.value === '' ? EMPTY : o.value}
                className="relative flex cursor-pointer select-none items-center rounded-md py-1.5 pl-3 pr-8 text-sm text-ink outline-none transition-colors data-[highlighted]:bg-[#f5f5fa] data-[state=checked]:bg-coral-soft data-[state=checked]:font-medium data-[state=checked]:text-[#0E7490]"
              >
                <RS.ItemText>{o.label}</RS.ItemText>
                <RS.ItemIndicator className="absolute right-2 text-[#0E7490]">
                  <Check size={14} strokeWidth={2.5} aria-hidden />
                </RS.ItemIndicator>
              </RS.Item>
            ))}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  )
}
