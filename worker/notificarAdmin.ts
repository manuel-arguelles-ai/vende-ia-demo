/**
 * Notifica al operador (el asesor) por WhatsApp usando la sesión del tenant 1 (Nina),
 * SIN guardar en el historial del CRM. Best-effort: cualquier problema → { ok:false },
 * nunca lanza. Extraído como helper puro para poder testearlo sin HTTP.
 */
type SesionMin = { sock: { sendMessage: (jid: string, m: { text: string }) => Promise<unknown> }; connected: boolean }

export async function notificarAdmin(
  sesiones: Map<number, SesionMin>,
  adminJid: string | null,
  texto: string,
): Promise<{ ok: boolean }> {
  if (!adminJid || !texto || !texto.trim()) return { ok: false }
  const s = sesiones.get(1)
  if (!s || !s.connected) return { ok: false }
  try {
    await s.sock.sendMessage(adminJid, { text: texto })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
