import { describe, it, expect } from 'vitest'
import { jidANumero, avisoHandoff, telefonoMostrado } from '../handoff'
import type { PedidoGuardado } from '../schemas'

describe('telefonoMostrado', () => {
  it('usa extra._tel cuando el remitente es un LID opaco', () => {
    expect(telefonoMostrado('216294620180492@lid', { _tel: '51900000003@s.whatsapp.net' })).toBe('51900000003')
  })
  it('cae al remitente si no hay _tel', () => {
    expect(telefonoMostrado('51900000002@s.whatsapp.net', {})).toBe('51900000002')
    expect(telefonoMostrado('51900000002@s.whatsapp.net', null)).toBe('51900000002')
  })
  it('ignora _tel vacío', () => {
    expect(telefonoMostrado('51900000002@s.whatsapp.net', { _tel: '' })).toBe('51900000002')
  })
})

const saved: PedidoGuardado = {
  producto: 'aceite de coco', color: null, talla: null, cantidad: 2,
  extra: {}, necesita_aclaracion: false,
  temperatura: 'caliente', score: 92, razon: 'confirma pago',
  canal: 'whatsapp', remitente: '51900000002@s.whatsapp.net',
  mensaje_crudo: 'lo quiero, pago yape', derivar: true, estado: 'derivado',
}

describe('jidANumero', () => {
  it('extrae el número de un jid de WhatsApp', () => {
    expect(jidANumero('51900000002@s.whatsapp.net')).toBe('51900000002')
  })
  it('descarta el sufijo de dispositivo', () => {
    expect(jidANumero('51900000002:12@s.whatsapp.net')).toBe('51900000002')
  })
})

describe('avisoHandoff', () => {
  const aviso = avisoHandoff({
    remitente: '51900000002@s.whatsapp.net',
    handoff: 'Quiere 2 aceites de coco BioSelva, paga por yape, zona Surco. Listo para cerrar.',
    saved,
  })

  it('incluye el resumen del asesor', () => {
    expect(aviso).toContain('paga por yape')
  })
  it('incluye un link wa.me al cliente para continuar el chat', () => {
    expect(aviso).toContain('https://wa.me/51900000002')
  })
  it('incluye temperatura y score', () => {
    expect(aviso).toContain('caliente')
    expect(aviso).toContain('92')
  })

  it('usa un resumen por defecto si handoff viene null', () => {
    const a = avisoHandoff({ remitente: '519@s.whatsapp.net', handoff: null, saved })
    expect(a).toContain('listo para cerrar')
  })

  it('usa el teléfono real cuando el remitente es un LID', () => {
    const a = avisoHandoff({ remitente: '999@lid', handoff: 'listo', saved, telefono: '51987654321@s.whatsapp.net' })
    expect(a).toContain('https://wa.me/51987654321')
    expect(a).toContain('+51987654321')
  })
})
