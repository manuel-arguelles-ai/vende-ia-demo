// Transcodificación de audio con ffmpeg (requiere ffmpeg en el contenedor).
// WhatsApp espera las notas de voz (ptt) en OGG/Opus mono.

import { spawn } from 'child_process'

/** Convierte un buffer de audio (wav/mp3/…) a OGG/Opus mono 48k apto para WhatsApp ptt. */
export function aOggOpus(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-ac', '1', '-ar', '48000',
      '-c:a', 'libopus', '-b:a', '32k',
      '-f', 'ogg', 'pipe:1',
    ])
    const out: Buffer[] = []
    const err: Buffer[] = []
    ff.stdout.on('data', (d) => out.push(d))
    ff.stderr.on('data', (d) => err.push(d))
    ff.on('error', reject)
    ff.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out))
      else reject(new Error(`ffmpeg salió ${code}: ${Buffer.concat(err).toString().slice(0, 300)}`))
    })
    ff.stdin.on('error', () => { /* EPIPE si ffmpeg muere antes; lo reporta close */ })
    ff.stdin.write(input)
    ff.stdin.end()
  })
}
