/**
 * Tests TDD para parametrización del prompt por tenant (Task 7).
 *
 * Nota: el golden de Nina ya no vive aquí (se movió a nina-golden.test.ts + fixture).
 * Este archivo cubre: identidad Asistente/Tienda Genérica por defecto, sustitución de tenant,
 * y secciones opcionales de tono e instrucciones.
 */
import { describe, it, expect } from 'vitest'
import { construirSystem } from '../conversar'

describe('construirSystem', () => {
  describe('identidad default Asistente/Tienda Genérica (sin args)', () => {
    it('sin args produce prompt con identidad Asistente/Tienda Genérica, nunca Nina', () => {
      const result = construirSystem()
      expect(result).toContain('Asistente')
      expect(result).toContain('Tienda Genérica')
      expect(result).not.toContain('Nina')
    })
  })

  describe('sustitución de tenant', () => {
    it('con negocioNombre y rubro de otro tenant: la primera línea contiene el nuevo negocio', () => {
      const result = construirSystem({
        nombreBot: 'Tec',
        negocioNombre: 'TechPe',
        rubro: 'tecnología',
        categorias: 'software, hardware',
      })
      const primeraLinea = result.split('\n')[0]
      expect(result).toContain('TechPe')
      expect(result).toContain('tecnología')
      expect(result).toContain('software, hardware')
      // La primera línea (header) usa el nuevo negocioNombre, no Tienda Demo
      expect(primeraLinea).toContain('TechPe')
      expect(primeraLinea).not.toContain('Tienda Demo')
    })

    it('con negocioNombre distinto: el bot usa el nombreBot nuevo, no "Nina"', () => {
      const result = construirSystem({ nombreBot: 'Tec', negocioNombre: 'TechPe', rubro: 'tecnología', categorias: 'software, hardware' })
      expect(result).toContain('"Tec"')
      expect(result).not.toContain('"Nina"')
    })
  })

  describe('secciones opcionales tono e instrucciones', () => {
    it('instruccionesExtra se incluye al final cuando se pasa', () => {
      const result = construirSystem({ instruccionesExtra: 'Siempre ofrecer garantía extendida' })
      expect(result).toContain('INSTRUCCIONES DEL NEGOCIO: Siempre ofrecer garantía extendida')
    })

    it('sin instruccionesExtra NO aparece la sección INSTRUCCIONES DEL NEGOCIO', () => {
      const result = construirSystem()
      expect(result).not.toContain('INSTRUCCIONES DEL NEGOCIO')
    })

    it('tono formal inyecta bloque ESTILO DE TONO al final', () => {
      const result = construirSystem({ tono: 'formal' })
      expect(result).toContain('ESTILO DE TONO: tratá de usted')
    })

    it('sin tono (baseline cercano) NO aparece bloque ESTILO DE TONO', () => {
      const result = construirSystem()
      expect(result).not.toContain('ESTILO DE TONO')
    })

    it('bloque de tono aparece ANTES de instruccionesExtra cuando ambos se pasan', () => {
      const result = construirSystem({ tono: 'formal', instruccionesExtra: 'X' })
      const idxTono = result.indexOf('\n\nESTILO DE TONO:')
      const idxInstrucciones = result.indexOf('\n\nINSTRUCCIONES DEL NEGOCIO:')
      expect(idxTono).toBeGreaterThan(-1)
      expect(idxInstrucciones).toBeGreaterThan(-1)
      expect(idxTono).toBeLessThan(idxInstrucciones)
    })

    it('valores null/undefined se tratan como ausentes (no añaden secciones)', () => {
      const withNull = construirSystem({ instruccionesExtra: null })
      const withoutExtra = construirSystem({})
      expect(withNull).toBe(withoutExtra)
    })
  })
})
