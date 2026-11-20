// STT — transcribe notas de voz entrantes de WhatsApp (OGG/Opus) a texto.
// Por defecto usa Groq Whisper (whisper-large-v3): rápido, barato, gran español.
// No agrega dependencias: usa fetch/FormData/Blob globales (Node 22).
//
// Patrón "voice for your agent": esto es solo el frente de voz; el cerebro
// (lib/core/atender) recibe el texto y no cambia.

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const OPENAI_URL = 'https://api.openai.com/v1/audio/transcriptions'

export interface STTResult {
  texto: string
  ok: boolean
  error?: string
}

/** Transcribe un buffer de audio. mime ej: 'audio/ogg'. lang ISO ej 'es'. */
export async function transcribir(
  audio: Buffer,
  mime = 'audio/ogg',
  lang = 'es',
): Promise<STTResult> {
  const provider = (process.env.STT_PROVIDER || 'groq').toLowerCase()
  const groqKey = process.env.GROQ_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  const usarGroq = provider === 'groq' && groqKey
  const key = usarGroq ? groqKey : openaiKey
  const url = usarGroq ? GROQ_URL : OPENAI_URL
  const model = usarGroq ? 'whisper-large-v3' : 'whisper-1'

  if (!key) {
    return { texto: '', ok: false, error: 'falta GROQ_API_KEY / OPENAI_API_KEY' }
  }

  const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : 'wav'
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(audio)], { type: mime }), `voz.${ext}`)
  form.append('model', model)
  form.append('language', lang)
  form.append('response_format', 'json')

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    })
    if (!resp.ok) {
      return { texto: '', ok: false, error: `STT ${resp.status}: ${(await resp.text()).slice(0, 200)}` }
    }
    const data = (await resp.json()) as { text?: string }
    return { texto: (data.text || '').trim(), ok: true }
  } catch (e) {
    return { texto: '', ok: false, error: String(e) }
  }
}
