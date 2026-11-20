import { estiloTemperatura } from '@/lib/core/semaforo-style'
import type { Scoring } from '@/lib/core/schemas'

export function Semaforo({ temperatura, score }: { temperatura: Scoring['temperatura']; score: number }) {
  const s = estiloTemperatura(temperatura)
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-white ${s.color}`}>
      {s.emoji} {s.label} · {score}
    </span>
  )
}
