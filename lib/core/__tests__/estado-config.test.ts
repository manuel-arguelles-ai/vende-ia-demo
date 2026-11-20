import { describe, it, expect } from 'vitest'
import { estadoConfiguracion } from '../superadmin-detalle'

const base = {
  negocio: {}, agente: { nombreBot: 'X', tono: 'cercano', rubro: null } as never,
  tiendas: [], usuarios: [{ id: 1, nombre: null, email: 'a@a', rol: 'admin', activo: true }],
}

describe('estadoConfiguracion', () => {
  it('todo vacío → pct bajo, items faltantes marcados', () => {
    const r = estadoConfiguracion(base, { productos: 0, whatsappConectado: false })
    expect(r.pct).toBe(0)
    expect(r.items.every((i) => !i.ok)).toBe(true)
  })
  it('configuración completa → 100%', () => {
    const r = estadoConfiguracion({
      negocio: { yape: '999', horario: '9-6' },
      agente: { rubro: 'librería' } as never,
      tiendas: [{ id: 1, nombre: 'C', direccion: null, distrito: null, horario: null, activa: true }],
      usuarios: [{ id: 1, nombre: null, email: 'a@a', rol: 'admin', activo: true }, { id: 2, nombre: 'A', email: 'b@b', rol: 'asesor', activo: true }],
    }, { productos: 50, whatsappConectado: true })
    expect(r.pct).toBe(100)
  })
  it('parcial: pagos + catálogo → ~29%', () => {
    const r = estadoConfiguracion({ ...base, negocio: { yape: '999' } }, { productos: 10, whatsappConectado: false })
    expect(r.items.find((i) => i.item.includes('pago'))?.ok).toBe(true)
    expect(r.items.find((i) => i.item.includes('Catálogo'))?.ok).toBe(true)
    expect(r.pct).toBeGreaterThan(0)
  })
})
