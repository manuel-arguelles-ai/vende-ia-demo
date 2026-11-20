// TTS — sintetiza la respuesta del agente como nota de voz (Kokoro self-hosted).
// Llama al microservicio Kokoro (KOKORO_URL) que devuelve WAV; lo transcodifica
// a OGG/Opus para enviarlo como ptt por WhatsApp.
//
// El cerebro (atender) no sabe nada de esto: solo le pasamos su texto de salida.

import { aOggOpus } from './audio'

export interface TTSResult {
  ogg?: Buffer
  ok: boolean
  error?: string
}

// Límite defensivo: notas de voz muy largas cansan; recortamos a una longitud sana.
const MAX_CHARS = Number(process.env.VOZ_MAX_CHARS || 600)

/** Texto -> nota de voz OGG/Opus vía Kokoro. Voz por defecto: ef_dora (español). */
export async function sintetizar(texto: string, voz = process.env.KOKORO_VOICE || 'ef_dora'): Promise<TTSResult> {
  const base = process.env.KOKORO_URL
  if (!base) return { ok: false, error: 'falta KOKORO_URL' }

  const limpio = texto.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS)
  if (!limpio) return { ok: false, error: 'texto vacío' }

  try {
    const resp = await fetch(`${base.replace(/\/$/, '')}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.KOKORO_TOKEN ? { Authorization: `Bearer ${process.env.KOKORO_TOKEN}` } : {}),
      },
      body: JSON.stringify({ text: limpio, voice: voz, lang: 'e' }),
    })
    if (!resp.ok) return { ok: false, error: `TTS ${resp.status}: ${(await resp.text()).slice(0, 200)}` }
    const wav = Buffer.from(await resp.arrayBuffer())
    const ogg = await aOggOpus(wav)
    return { ogg, ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
