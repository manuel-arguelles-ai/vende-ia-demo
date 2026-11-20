/**
 * Pure auth helper for the worker HTTP server.
 * Extracted so it can be unit-tested without an HTTP harness.
 *
 * Logic:
 *   1. WORKER_DEV=1  → always allow (explicit dev escape hatch)
 *   2. No WORKER_TOKEN → DENY (fail-closed)
 *   3. Otherwise → require Authorization: Bearer <WORKER_TOKEN>
 */
export function workerAuthOk(
  authHeader: string | undefined,
  env: { WORKER_TOKEN?: string; WORKER_DEV?: string },
): boolean {
  if (env.WORKER_DEV === '1') return true
  const token = env.WORKER_TOKEN
  if (!token) return false
  return authHeader === `Bearer ${token}`
}
