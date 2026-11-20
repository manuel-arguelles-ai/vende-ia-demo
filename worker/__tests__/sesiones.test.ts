/**
 * Tests unitarios del session manager (worker/sesiones.ts).
 * Se mockean todas las dependencias externas (Baileys, pino, atender, etc.)
 * para poder testear la lógica del Map y la migración Nina sin un socket real.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Mocks — deben declararse ANTES de los imports del módulo bajo prueba.
// ---------------------------------------------------------------------------

// Mock de Baileys: makeWASocket devuelve un objeto mínimo con ev.on/ev.off.
const mockSock = {
  ev: {
    on: vi.fn(),
    off: vi.fn(),
  },
  sendMessage: vi.fn(),
  signalRepository: {
    lidMapping: {
      getPNForLID: vi.fn(),
    },
  },
}

vi.mock('@whiskeysockets/baileys', () => ({
  default: vi.fn(() => mockSock),
  DisconnectReason: { loggedOut: 401 },
  fetchLatestBaileysVersion: vi.fn(async () => ({ version: [2, 3000, 0] })),
  useMultiFileAuthState: vi.fn(async () => ({
    state: {},
    saveCreds: vi.fn(),
  })),
  downloadMediaMessage: vi.fn(),
}))

vi.mock('pino', () => ({
  default: vi.fn(() => ({ level: 'warn', warn: vi.fn(), error: vi.fn() })),
}))

vi.mock('qrcode-terminal', () => ({
  default: { generate: vi.fn() },
}))

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async () => 'data:image/png;base64,test'),
    toFile: vi.fn(async () => {}),
  },
}))

vi.mock('../../lib/core/atender', () => ({
  atender: vi.fn(async () => ({ respuesta: 'ok', silenciado: false, etapa: 'test', derivar: false, saved: null })),
}))

vi.mock('../../lib/core/handoff', () => ({
  avisoHandoff: vi.fn(() => 'handoff text'),
}))

vi.mock('../../lib/core/db', () => ({
  supabaseAdmin: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({ like: vi.fn(() => ({ order: vi.fn(async () => ({ data: [], error: null })) })) })),
      update: vi.fn(() => ({ eq: vi.fn(async () => ({})) })),
    })),
  })),
}))

vi.mock('../../lib/core/historial', () => ({
  guardarMensaje: vi.fn(async () => {}),
}))

vi.mock('../voz/stt', () => ({
  transcribir: vi.fn(async () => ({ ok: false, texto: '', error: 'mock' })),
}))

vi.mock('../voz/tts', () => ({
  sintetizar: vi.fn(async () => ({ ok: false, ogg: null, error: 'mock' })),
}))

// ---------------------------------------------------------------------------
// Importar el módulo bajo prueba DESPUÉS de los mocks.
// ---------------------------------------------------------------------------
// Nota: los imports estáticos de vi.mock se elevan (hoisted) por vitest.
import { sesiones, iniciarSesion, migrarPlana, bootSesiones, limpiarAuthDir, esJidIgnorable } from '../sesiones.js'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('esJidIgnorable — filtra estados/grupos/difusiones', () => {
  it('ignora status, broadcast, grupos y newsletters', () => {
    for (const j of ['status@broadcast', '123@broadcast', '120363@g.us', 'abc@newsletter', '', null, undefined])
      expect(esJidIgnorable(j)).toBe(true)
  })
  it('NO ignora un número de cliente normal', () => {
    expect(esJidIgnorable('51999888777@s.whatsapp.net')).toBe(false)
    expect(esJidIgnorable('224466@lid')).toBe(false)
  })
})

describe('session manager — Map', () => {
  beforeEach(() => {
    sesiones.clear()
    vi.clearAllMocks()
  })

  it('iniciarSesion agrega la sesión al Map', async () => {
    await iniciarSesion(42)
    expect(sesiones.has(42)).toBe(true)
    const s = sesiones.get(42)!
    expect(s.tenantId).toBe(42)
    expect(s.connected).toBe(false)
    expect(s.qr).toBeNull()
    expect(s.sock).toBeDefined()
  })

  it('iniciarSesion es idempotente — no duplica si ya está conectado', async () => {
    await iniciarSesion(7)
    const s = sesiones.get(7)!
    // Simular estado conectado.
    s.connected = true

    const makeWASocket = (await import('@whiskeysockets/baileys')).default
    const callsAntes = (makeWASocket as ReturnType<typeof vi.fn>).mock.calls.length

    await iniciarSesion(7) // segunda llamada — debe salir temprano

    const callsDespues = (makeWASocket as ReturnType<typeof vi.fn>).mock.calls.length
    expect(callsDespues).toBe(callsAntes) // sin llamada extra a makeWASocket
    expect(sesiones.size).toBe(1) // sigue siendo 1 sesión
  })

  it('iniciarSesion para tenants distintos crea sesiones separadas', async () => {
    // Para que no choque con la idempotencia, limpiar el Map primero.
    sesiones.clear()
    await iniciarSesion(1)
    await iniciarSesion(2)
    expect(sesiones.has(1)).toBe(true)
    expect(sesiones.has(2)).toBe(true)
    expect(sesiones.size).toBe(2)
    expect(sesiones.get(1)!.tenantId).toBe(1)
    expect(sesiones.get(2)!.tenantId).toBe(2)
  })
})

describe('migrarPlana — migración de auth plana → WA_AUTH_DIR/1/', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vende-ia-test-'))
    process.env.WA_AUTH_DIR = tmpDir
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    delete process.env.WA_AUTH_DIR
  })

  it('mueve creds.json y archivos .json planos a WA_AUTH_DIR/1/', async () => {
    // Preparar auth plana.
    fs.writeFileSync(path.join(tmpDir, 'creds.json'), '{"type":"creds"}')
    fs.writeFileSync(path.join(tmpDir, 'app-state-sync-key-AAAA.json'), '{"key":"data"}')
    fs.writeFileSync(path.join(tmpDir, 'app-state-sync-key-BBBB.json'), '{"key":"data2"}')

    await migrarPlana()

    // Los archivos deben estar en el subdir 1/.
    expect(fs.existsSync(path.join(tmpDir, '1', 'creds.json'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, '1', 'app-state-sync-key-AAAA.json'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, '1', 'app-state-sync-key-BBBB.json'))).toBe(true)

    // Los archivos originales deben haberse movido (no copiado).
    expect(fs.existsSync(path.join(tmpDir, 'creds.json'))).toBe(false)
    expect(fs.existsSync(path.join(tmpDir, 'app-state-sync-key-AAAA.json'))).toBe(false)
  })

  it('no migra si WA_AUTH_DIR/1 ya existe', async () => {
    // Simular migración previa.
    fs.mkdirSync(path.join(tmpDir, '1'))
    fs.writeFileSync(path.join(tmpDir, '1', 'creds.json'), '{"from":"previous"}')
    // Hay creds planos también (escenario improbable pero defensivo).
    fs.writeFileSync(path.join(tmpDir, 'creds.json'), '{"from":"flat"}')

    await migrarPlana()

    // El creds.json en raíz NO debe moverse (1/ ya existía).
    expect(fs.existsSync(path.join(tmpDir, 'creds.json'))).toBe(true)
    // El creds.json en 1/ debe ser el original (no pisado).
    const content = fs.readFileSync(path.join(tmpDir, '1', 'creds.json'), 'utf-8')
    expect(content).toBe('{"from":"previous"}')
  })

  it('no hace nada si no hay creds.json plano', async () => {
    // Dir vacío.
    await migrarPlana() // no debe lanzar

    expect(fs.existsSync(path.join(tmpDir, '1'))).toBe(false)
  })
})

describe('bootSesiones — reconexión de sesiones persistidas', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vende-ia-boot-test-'))
    process.env.WA_AUTH_DIR = tmpDir
    sesiones.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    delete process.env.WA_AUTH_DIR
  })

  it('inicia sesiones para subdirs numéricos que tienen creds.json', async () => {
    // Crear subdir 1 y 3 con creds.json; subdir "abc" y 2 (sin creds) deben ignorarse.
    fs.mkdirSync(path.join(tmpDir, '1'))
    fs.writeFileSync(path.join(tmpDir, '1', 'creds.json'), '{}')
    fs.mkdirSync(path.join(tmpDir, '2'))
    // 2 no tiene creds.json → se omite
    fs.mkdirSync(path.join(tmpDir, '3'))
    fs.writeFileSync(path.join(tmpDir, '3', 'creds.json'), '{}')
    fs.mkdirSync(path.join(tmpDir, 'abc'))
    fs.writeFileSync(path.join(tmpDir, 'abc', 'creds.json'), '{}') // no numérico → se omite

    await bootSesiones()

    expect(sesiones.has(1)).toBe(true)
    expect(sesiones.has(3)).toBe(true)
    expect(sesiones.has(2)).toBe(false)
  })
})

describe('limpiarAuthDir — limpieza de credenciales deslogueadas', () => {
  let tmpDir: string
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vende-ia-clean-test-'))
    process.env.WA_AUTH_DIR = tmpDir
  })
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    delete process.env.WA_AUTH_DIR
  })

  it('borra el authDir del tenant (creds muertas) y devuelve true', () => {
    const dir6 = path.join(tmpDir, '6')
    fs.mkdirSync(dir6, { recursive: true })
    fs.writeFileSync(path.join(dir6, 'creds.json'), '{"dead":true}')
    expect(fs.existsSync(dir6)).toBe(true)

    expect(limpiarAuthDir(6)).toBe(true)
    expect(fs.existsSync(dir6)).toBe(false)
  })

  it('no toca el authDir de otros tenants (p.ej. Nina/1)', () => {
    fs.mkdirSync(path.join(tmpDir, '1'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, '1', 'creds.json'), '{"lima":true}')
    fs.mkdirSync(path.join(tmpDir, '6'), { recursive: true })

    limpiarAuthDir(6)
    expect(fs.existsSync(path.join(tmpDir, '6'))).toBe(false)
    expect(fs.existsSync(path.join(tmpDir, '1', 'creds.json'))).toBe(true)
  })

  it('es idempotente: no lanza si el dir no existe', () => {
    expect(limpiarAuthDir(99)).toBe(true)
  })
})
