import type { Scoring } from './schemas'

export function estiloTemperatura(t: Scoring['temperatura']): {
  color: string; emoji: string; label: string
} {
  switch (t) {
    case 'caliente': return { color: 'bg-red-500', emoji: '🔥', label: 'Caliente' }
    case 'tibio': return { color: 'bg-amber-400', emoji: '🌤️', label: 'Tibio' }
    case 'frio': return { color: 'bg-blue-400', emoji: '❄️', label: 'Frío' }
  }
}
