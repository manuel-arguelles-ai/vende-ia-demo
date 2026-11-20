// B1/B5 — Loop de seguimiento proactivo del worker. CONTROL = toggle por inquilino
// (negocio.seguimiento_auto, editable en "Mi Negocio"). La env SEGUIMIENTOS_AUTO es solo
// un KILL-SWITCH global de emergencia: si vale '0' apaga TODO; en cualquier otro caso manda
// el toggle del inquilino. Recorre las sesiones Baileys vivas y manda los toques debidos.
import { sesiones } from './sesiones.js'
import { procesarSeguimientos, cargarLeads, cargarEnviados, registrarToque } from '../lib/core/seguimientos-run'
import { obtenerNegocio } from '../lib/core/negocio'
import { guardarMensaje } from '../lib/core/historial'

export async function correrSeguimientos(): Promise<void> {
  if (process.env.SEGUIMIENTOS_AUTO === '0') return // kill-switch global de emergencia
  const ahoraMs = Date.now()
  for (const [tenantId, sesion] of sesiones) {
    try {
      const r = await procesarSeguimientos(tenantId, {
        obtenerNegocio, cargarLeads, cargarEnviados, registrarToque, ahoraMs,
        enviar: async (remitente: string, texto: string) => {
          await sesion.sock.sendMessage(remitente, { text: texto })
          await guardarMensaje(remitente, 'bot', texto, 'seguimiento', tenantId)
        },
      })
      if (r.enviados) console.log(`[seguimientos] tenant ${tenantId}: ${r.enviados} toque(s) enviados`)
    } catch (e) {
      console.error('[seguimientos] tenant', tenantId, 'falló (se ignora):', e)
    }
  }
}
