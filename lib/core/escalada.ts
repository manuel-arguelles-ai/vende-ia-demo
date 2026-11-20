// B6 — Escalada a humano por temas sensibles (reclamo, fraude, no-entrega, reembolso).
// Determinista: ante una palabra crítica forzamos derivar=true con un handoff de contexto,
// sin depender de que el LLM lo detecte. Mejor sobre-escalar un caso sensible que ignorarlo.

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

// Frases críticas (normalizadas, sin acentos). Foco en quejas/fraude/incumplimiento.
const CRITICAS = [
  'reclamo', 'reclamar', 'queja', 'fraude', 'estafa', 'estafaron', 'me robaron',
  'denuncia', 'denunciar', 'indecopi', 'demanda', 'demandar', 'abogado',
  'reembolso', 'devuelvan mi', 'me devuelvan', 'quiero mi dinero',
  'no llego', 'no me llego', 'nunca llego', 'no ha llegado', 'todavia no llega',
  'producto fallado', 'llego roto', 'llego mal', 'esto es una verguenza',
]

export function requiereEscalada(mensaje: string): boolean {
  const t = norm(mensaje)
  return CRITICAS.some((k) => t.includes(norm(k)))
}

export function resumenEscalada(mensaje: string): string {
  return `⚠️ ESCALAR (tema sensible): el cliente escribió «${mensaje.trim().slice(0, 140)}». Atender con prioridad humana.`
}
