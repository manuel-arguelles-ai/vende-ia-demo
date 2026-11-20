import { describe, it, expect } from 'vitest'
import { prioridadLead, ordenarLeadsAsesor } from './prioridad'
import type { Conversacion } from '@/lib/core/conversaciones'

const AHORA = 1_000_000_000
function lead(p: Partial<Conversacion>): Conversacion {
  return {
    remitente: 'x', numero: '1', nombre: null, turnos: [], temperatura: 'frio',
    score: null, derivado: false, enAtencion: false, cierre: null, etiquetas: [],
    recordatorio: null, zona: null, producto: null, ultimoAt: null, ...p,
  } as Conversacion
}

describe('prioridadLead', () => {
  it('ordena por estado de trabajo del asesor', () => {
    expect(prioridadLead(lead({ recordatorio: new Date(AHORA - 1000).toISOString() }), AHORA)).toBe(0)
    expect(prioridadLead(lead({ temperatura: 'caliente' }), AHORA)).toBe(1)
    expect(prioridadLead(lead({ derivado: true }), AHORA)).toBe(2)
    expect(prioridadLead(lead({ enAtencion: true }), AHORA)).toBe(3)
    expect(prioridadLead(lead({ temperatura: 'frio' }), AHORA)).toBe(4)
    expect(prioridadLead(lead({ cierre: { estado: 'ganado', monto: 10 } }), AHORA)).toBe(5)
  })
  it('un caliente que ya está en atención no es prioridad 1', () => {
    expect(prioridadLead(lead({ temperatura: 'caliente', enAtencion: true }), AHORA)).toBe(3)
  })
})

describe('ordenarLeadsAsesor', () => {
  it('vencido primero, cerrado último; empate por más reciente', () => {
    const vencido = lead({ remitente: 'v', recordatorio: new Date(AHORA - 1).toISOString() })
    const caliente = lead({ remitente: 'c', temperatura: 'caliente' })
    const cerrado = lead({ remitente: 'z', cierre: { estado: 'ganado', monto: 5 } })
    const frioViejo = lead({ remitente: 'f1', ultimoAt: new Date(AHORA - 9999).toISOString() })
    const frioNuevo = lead({ remitente: 'f2', ultimoAt: new Date(AHORA - 10).toISOString() })
    const orden = ordenarLeadsAsesor([cerrado, frioViejo, caliente, frioNuevo, vencido], AHORA)
    expect(orden.map((c) => c.remitente)).toEqual(['v', 'c', 'f2', 'f1', 'z'])
  })
})
