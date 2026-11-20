const VENTANA_MS = 60_000
const MAX = 20

type Bucket = { count: number; desde: number }
const buckets = new Map<string, Bucket>()

export function excedeRate(clave: string, ahora: number = Date.now()): boolean {
  const b = buckets.get(clave)
  if (!b || ahora - b.desde > VENTANA_MS) {
    buckets.set(clave, { count: 1, desde: ahora })
    return false
  }
  if (b.count >= MAX) return true
  b.count++
  return false
}

// Solo para tests.
export function __resetRate(): void {
  buckets.clear()
}
