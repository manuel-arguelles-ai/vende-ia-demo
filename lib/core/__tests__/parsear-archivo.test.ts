import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parsearArchivo, detectarSeparador } from '../parsear-archivo'
import { parseDecimal } from '../importar-catalogo'

describe('detectarSeparador', () => {
  it('detecta ; cuando hay más punto y coma', () => {
    expect(detectarSeparador('a;b;c')).toBe(';')
  })
  it('cae a coma por defecto', () => {
    expect(detectarSeparador('a,b,c')).toBe(',')
  })
})

describe('parseDecimal', () => {
  it('parsea decimal con punto', () => { expect(parseDecimal('49.00')).toBe(49) })
  it('parsea decimal con coma', () => { expect(parseDecimal('49,50')).toBe(49.5) })
  it('vacío → NaN', () => { expect(Number.isNaN(parseDecimal(''))).toBe(true) })
})

describe('parsearArchivo', () => {
  it('CSV con coma', () => {
    const buf = Buffer.from('nombre,precio\nAceite,49\n', 'utf-8')
    expect(parsearArchivo(buf, 'c.csv')).toEqual([['nombre', 'precio'], ['Aceite', '49']])
  })
  it('CSV con punto y coma', () => {
    const buf = Buffer.from('nombre;precio\nAceite;49,50\n', 'utf-8')
    expect(parsearArchivo(buf, 'c.csv')).toEqual([['nombre', 'precio'], ['Aceite', '49,50']])
  })
  it('XLSX', () => {
    const ws = XLSX.utils.aoa_to_sheet([['nombre', 'precio'], ['Aceite', 49]])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Hoja1')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    expect(parsearArchivo(buf, 'c.xlsx')).toEqual([['nombre', 'precio'], ['Aceite', '49']])
  })
})
