import { describe, it, expect } from 'vitest'
import { permisoDe, seccionVisible, puedeEditarSeccion } from '../permisos'

const ADMIN = { usuarioId: 1, tenantId: 1, rol: 'admin' }
const ASESOR = { usuarioId: 2, tenantId: 1, rol: 'asesor' }

describe('permisoDe', () => {
  it('default = editar cuando falta config', () => {
    expect(permisoDe(undefined, 'pipeline')).toBe('editar')
    expect(permisoDe({}, 'contactos')).toBe('editar')
  })
  it('devuelve el valor configurado', () => {
    expect(permisoDe({ contactos: 'ver' }, 'contactos')).toBe('ver')
    expect(permisoDe({ catalogo: 'oculto' }, 'catalogo')).toBe('oculto')
  })
})

describe('seccionVisible', () => {
  it('admin ve todo, sin importar la config', () => {
    expect(seccionVisible(ADMIN, { pipeline: 'oculto' }, 'pipeline')).toBe(true)
  })
  it('asesor: visible salvo oculto', () => {
    expect(seccionVisible(ASESOR, { contactos: 'oculto' }, 'contactos')).toBe(false)
    expect(seccionVisible(ASESOR, { contactos: 'ver' }, 'contactos')).toBe(true)
    expect(seccionVisible(ASESOR, undefined, 'pipeline')).toBe(true) // default editar → visible
  })
})

describe('puedeEditarSeccion', () => {
  it('admin siempre edita', () => {
    expect(puedeEditarSeccion(ADMIN, { contactos: 'ver' }, 'contactos')).toBe(true)
  })
  it('asesor edita solo con permiso editar', () => {
    expect(puedeEditarSeccion(ASESOR, { pipeline: 'editar' }, 'pipeline')).toBe(true)
    expect(puedeEditarSeccion(ASESOR, { pipeline: 'ver' }, 'pipeline')).toBe(false)
    expect(puedeEditarSeccion(ASESOR, { pipeline: 'oculto' }, 'pipeline')).toBe(false)
    expect(puedeEditarSeccion(ASESOR, undefined, 'pipeline')).toBe(true) // default editar
  })
})
