// Sistema de temas: cada tema define 7 colores "core"; el resto de las CSS vars
// se derivan. Aplicar un tema = setear las vars en <html>, que es lo que consumen
// las clases de Tailwind (var(--color-X) → var(--X)).

export type CoreVars = {
  paper: string
  card: string
  ink: string
  muted: string
  line: string
  coral: string
  sage: string
}

// Colores editables en el modo Custom (en orden de aparición).
export const CORE_LABELS: { key: keyof CoreVars; label: string }[] = [
  { key: 'paper', label: 'Fondo' },
  { key: 'card', label: 'Superficie / tarjetas' },
  { key: 'ink', label: 'Texto' },
  { key: 'muted', label: 'Texto tenue' },
  { key: 'line', label: 'Bordes' },
  { key: 'coral', label: 'Acento' },
  { key: 'sage', label: 'Secundario' },
]

export type Preset = { id: string; nombre: string; oscuro?: boolean; core: CoreVars }

export const PRESETS: Preset[] = [
  { id: 'light', nombre: 'Turquesa', core: { paper: '#f5f5fa', card: '#ffffff', ink: '#1c1d21', muted: '#8181a5', line: '#e2e2ec', coral: '#0891b2', sage: '#17a877' } },
  { id: 'calido', nombre: 'Papel cálido', core: { paper: '#f7f3ec', card: '#fffdf9', ink: '#211f1a', muted: '#8a8478', line: '#e6dfd2', coral: '#e0633f', sage: '#3f6b52' } },
  { id: 'dark', nombre: 'Oscuro', oscuro: true, core: { paper: '#161412', card: '#201d18', ink: '#ece7dd', muted: '#9b9486', line: '#322e27', coral: '#ef7a52', sage: '#6fae8a' } },
  { id: 'oceano', nombre: 'Océano', core: { paper: '#eef3f7', card: '#ffffff', ink: '#15242e', muted: '#6b7c87', line: '#d8e3ea', coral: '#0e8a92', sage: '#2f6f7a' } },
  { id: 'bosque', nombre: 'Bosque', core: { paper: '#eef3ec', card: '#fcfefb', ink: '#1b2a1f', muted: '#6f7d71', line: '#d9e4d6', coral: '#c2683a', sage: '#2f7a4f' } },
  { id: 'lavanda', nombre: 'Noche lavanda', oscuro: true, core: { paper: '#17151f', card: '#211e2c', ink: '#ece9f5', muted: '#9a92ad', line: '#322d40', coral: '#b48cf0', sage: '#7fb0d8' } },
]

function hex(n: number) {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
}
function parse(h: string) {
  const s = h.replace('#', '')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}
// Mezcla a hacia b en proporción t (0..1).
export function blend(a: string, b: string, t: number) {
  const [r1, g1, b1] = parse(a)
  const [r2, g2, b2] = parse(b)
  return `#${hex(r1 + (r2 - r1) * t)}${hex(g1 + (g2 - g1) * t)}${hex(b1 + (b2 - b1) * t)}`
}

// Set completo de CSS vars a partir de los 7 core (deriva paper-2, *-soft y térmicos).
export function derivar(c: CoreVars): Record<string, string> {
  const FRIO = '#5b8fc9', TIBIO = '#d29a3a', CALIENTE = '#d6502e'
  return {
    paper: c.paper,
    'paper-2': blend(c.paper, c.ink, 0.05),
    card: c.card,
    ink: c.ink,
    muted: c.muted,
    line: c.line,
    coral: c.coral,
    'coral-soft': blend(c.card, c.coral, 0.14),
    sage: c.sage,
    'sage-soft': blend(c.card, c.sage, 0.14),
    frio: FRIO,
    'frio-soft': blend(c.card, FRIO, 0.14),
    tibio: TIBIO,
    'tibio-soft': blend(c.card, TIBIO, 0.16),
    caliente: CALIENTE,
    'caliente-soft': blend(c.card, CALIENTE, 0.14),
  }
}

// Aplica las vars al documento (lo que hace que cambie todo el tema).
export function aplicarVars(vars: Record<string, string>) {
  const el = document.documentElement
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(`--${k}`, v)
}
