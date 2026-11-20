// Lógica pura de "leads sin abrir": cuántos remitentes actuales no están
// en el set de vistos. `vistos === null` = aún no sembrado (primer uso) → 0.
export function calcularNuevos(vistos: string[] | null, actuales: string[]): number {
  if (vistos === null) return 0
  const set = new Set(vistos)
  return actuales.filter((r) => !set.has(r)).length
}
