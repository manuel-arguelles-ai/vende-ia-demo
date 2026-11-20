// Wrapper de fetch para mutaciones del CRM: nunca lanza, devuelve un resultado
// discriminado para que el componente toastee éxito/error de forma consistente.

export type MutarResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string }

export async function mutar<T = unknown>(url: string, opts: RequestInit = {}): Promise<MutarResult<T>> {
  try {
    const res = await fetch(url, {
      ...opts,
      headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
    })
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    if (!res.ok) {
      const error = (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string')
        ? (body as { error: string }).error
        : `Error ${res.status}`
      return { ok: false, error }
    }
    return { ok: true, data: body as T }
  } catch {
    return { ok: false, error: 'No se pudo conectar' }
  }
}

export function postJson<T = unknown>(url: string, body: unknown, method = 'POST'): Promise<MutarResult<T>> {
  return mutar<T>(url, { method, body: JSON.stringify(body) })
}
