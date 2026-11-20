import { describe, it, expect, vi } from 'vitest'
import { conversar } from '../conversar'

const reply = { respuesta: 'ok', etapa: 'enganche', score: 10, razon: '', derivar: false, handoff: null, etiquetas: [], temperatura: 'frio' }

describe('B4 — conversar usa datos conocidos del contacto (frictionless)', () => {
  it('incluye el bloque de datos conocidos cuando hay nombre/ciudad', async () => {
    const chat = vi.fn().mockResolvedValue(reply)
    await conversar({ mensaje: 'hola', historial: [], matches: [], contacto: { nombre: 'Ana', ciudad: 'Surco' } }, chat)
    const user = chat.mock.calls[0][0].user
    expect(user).toContain('DATOS YA CONOCIDOS')
    expect(user).toContain('nombre=Ana')
    expect(user).toContain('ciudad=Surco')
  })
  it('sin contacto no agrega el bloque', async () => {
    const chat = vi.fn().mockResolvedValue(reply)
    await conversar({ mensaje: 'hola', historial: [], matches: [] }, chat)
    expect(chat.mock.calls[0][0].user).not.toContain('DATOS YA CONOCIDOS')
  })
})

describe('medios de pago oficiales (el agente puede dar el nº oficial)', () => {
  it('incluye el Yape oficial con titular cuando hay pago configurado', async () => {
    const chat = vi.fn().mockResolvedValue(reply)
    await conversar({ mensaje: '¿a qué número pago?', historial: [], matches: [], pago: { yape: '900000001', titular: 'Librería Demo' } }, chat)
    const user = chat.mock.calls[0][0].user
    expect(user).toContain('MEDIOS DE PAGO OFICIALES')
    expect(user).toContain('Yape 900000001 a nombre de Librería Demo')
  })
  it('formatea la cuenta bancaria con tipo (corriente/ahorros) + CCI + titular', async () => {
    const chat = vi.fn().mockResolvedValue(reply)
    await conversar({ mensaje: '¿tienen cuenta?', historial: [], matches: [], pago: { titular: 'Librería Demo SAC', banco: 'BCP', cuenta: '000-0000000', tipoCuenta: 'corriente', cci: '002-194' } }, chat)
    const user = chat.mock.calls[0][0].user
    expect(user).toContain('Cuenta corriente BCP N° 000-0000000')
    expect(user).toContain('CCI 002-194')
    expect(user).toContain('a nombre de Librería Demo SAC')
  })
  it('usa titular distinto por método (Yape vs cuenta), con fallback al general', async () => {
    const chat = vi.fn().mockResolvedValue(reply)
    await conversar({ mensaje: '¿cómo pago?', historial: [], matches: [], pago: {
      yape: '900000001', titularYape: 'Titular Demo', titular: 'Librería Demo SAC',
      banco: 'BCP', cuenta: '000-0000000', tipoCuenta: 'corriente',
    } }, chat)
    const user = chat.mock.calls[0][0].user
    expect(user).toContain('Yape 900000001 a nombre de Titular Demo')          // específico de Yape
    expect(user).toContain('Cuenta corriente BCP N° 000-0000000 a nombre de Librería Demo SAC') // fallback al general
  })
  it('sin pago no agrega el bloque', async () => {
    const chat = vi.fn().mockResolvedValue(reply)
    await conversar({ mensaje: 'hola', historial: [], matches: [] }, chat)
    expect(chat.mock.calls[0][0].user).not.toContain('MEDIOS DE PAGO OFICIALES')
  })
})

describe('modo derivar — handoff limpio (no cierra ni vuelca pago/tiendas)', () => {
  const conPago = { yape: '900000001', titular: 'Librería Demo' }
  const tiendas = [{ nombre: 'Miraflores', direccion: 'Av. Larco 1150', horario: 'Lun-Dom 10-21' }]

  it('en modo cierre SÍ incluye tiendas (regla de cierre) y medios de pago', async () => {
    const chat = vi.fn().mockResolvedValue(reply)
    await conversar({ mensaje: 'lo quiero', historial: [], matches: [], modo: 'cierre', pago: conPago, tiendas }, chat)
    const user = chat.mock.calls[0][0].user
    expect(user).toContain('REGLA DE CIERRE')
    expect(user).toContain('MEDIOS DE PAGO OFICIALES')
  })

  it('en modo derivar NO inyecta la regla de cierre ni los datos de pago (handoff seco)', async () => {
    const chat = vi.fn().mockResolvedValue(reply)
    await conversar({ mensaje: 'lo quiero', historial: [], matches: [], modo: 'derivar', pago: conPago, tiendas }, chat)
    const user = chat.mock.calls[0][0].user
    expect(user).not.toContain('REGLA DE CIERRE')
    expect(user).not.toContain('MEDIOS DE PAGO OFICIALES')
    expect(user).not.toContain('900000001')
  })
})
