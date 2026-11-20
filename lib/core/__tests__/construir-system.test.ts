// lib/core/__tests__/construir-system.test.ts
import { describe, it, expect } from 'vitest'
import { construirSystem } from '../conversar'

describe('construirSystem — personalización por inquilino', () => {
  it('con identidad de otro inquilino, el prompt no menciona Nina', () => {
    const s = construirSystem({
      nombreBot: 'Vera', negocioNombre: 'Librería Demo',
      rubro: 'una cadena de librerías en Perú', categorias: 'novela, infantil, derecho, técnica',
    })
    expect(s).not.toMatch(/Nina/)
    expect(s).toContain('Vera')
    expect(s).toContain('Librería Demo')
  })

  it('tono neutral/formal y emojis off inyectan sus bloques; baseline no', () => {
    expect(construirSystem({ tono: 'cercano', emojis: true })).not.toContain('ESTILO DE TONO')
    expect(construirSystem({ tono: 'formal' })).toContain('tratá de usted')
    expect(construirSystem({ emojis: false })).toContain('no uses emojis')
  })

  it('intensidad de cierre y agresividad: baseline ∅, niveles emiten bloque', () => {
    expect(construirSystem({ intensidadCierre: 'cerrador' })).not.toContain('INTENSIDAD DE CIERRE')
    expect(construirSystem({ intensidadCierre: 'informativo' })).toContain('INFORMATIVA')
    expect(construirSystem({ agresividad: 'suave' })).not.toContain('URGENCIA =')
    expect(construirSystem({ agresividad: 'alta' })).toContain('URGENCIA = ALTA')
  })

  it('la guardia de honestidad acompaña SIEMPRE a la urgencia no-suave', () => {
    expect(construirSystem({ agresividad: 'media' })).toContain('PROHIBIDO inventar escasez')
    expect(construirSystem({ agresividad: 'alta' })).toContain('PROHIBIDO inventar escasez')
  })

  it('saludo/fallback/temas: solo aparecen si tienen valor', () => {
    expect(construirSystem({})).not.toContain('SALUDO INICIAL')
    expect(construirSystem({ saludoInicial: 'Hola! Soy X' })).toContain('SALUDO INICIAL')
    expect(construirSystem({ temasProhibidos: 'política' })).toContain('TEMAS PROHIBIDOS')
  })

  it('I3: cierre informativo + agresividad alta → urgencia solo informativa, sin CTA repetido', () => {
    const s = construirSystem({ intensidadCierre: 'informativo', agresividad: 'alta' })
    expect(s).toContain('solo informa disponibilidad real')
    expect(s).not.toContain('CTA repetido')
  })
  it('agresividad alta con cierre por default (cerrador) mantiene el CTA repetido', () => {
    const s = construirSystem({ agresividad: 'alta' })
    expect(s).toContain('CTA repetido')
  })

  // Bloque A — mejoras destiladas de los cursos (empatía, beneficio, cierre alternativo, regateo)
  describe('bloque A — técnicas de venta', () => {
    const s = construirSystem({})
    it('objeciones: validar con empatía antes de reformular', () => {
      expect(s).toContain('VALIDÁ con empatía')
    })
    it('recomendación: beneficio (para qué te sirve), no dato pelado + micro-relato', () => {
      expect(s).toContain('para qué te sirve')
      expect(s).toContain('micro-relato')
    })
    it('cierre por alternativa es el preferido por defecto', () => {
      expect(s).toContain('preferilo por defecto')
    })
    it('playbook cubre el regateo / pedido de descuento', () => {
      expect(s).toContain('me haces precio')
    })
    it('B2: modula el empuje según el calor del lead', () => {
      expect(s).toContain('MODULÁ EL EMPUJE')
    })
    it('usa "un asesor" (no "el asesor" genérico) y guía el nº de pago oficial', () => {
      expect(s).toContain('lo confirma un asesor')
      expect(s).not.toContain('los confirma el asesor')
      expect(s).toContain('NUNCA inventes')
    })
  })
})
