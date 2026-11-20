// Ruta base opcional de la app (NEXT_PUBLIC_BASE_PATH, p. ej. "/vende-ia").
// next.config.ts la usa como basePath; el cliente la usa para prefijar fetch().
// Vacía por defecto: la app se sirve en la raíz.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export function conBase(ruta: string): string {
  return `${BASE_PATH}${ruta}`
}
