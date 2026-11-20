import * as XLSX from 'xlsx'
import { parsearCSV } from './importar-catalogo'

export function detectarSeparador(primeraLinea: string): ',' | ';' {
  const puntoComa = (primeraLinea.match(/;/g) ?? []).length
  const coma = (primeraLinea.match(/,/g) ?? []).length
  return puntoComa > coma ? ';' : ','
}

function esXlsx(buf: Buffer, nombre: string): boolean {
  if (nombre.toLowerCase().endsWith('.xlsx')) return true
  // firma ZIP (xlsx es un zip): 'PK\x03\x04'
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04
}

export function parsearArchivo(buf: ArrayBuffer | Buffer, nombre: string): string[][] {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf)
  if (esXlsx(b, nombre)) {
    const wb = XLSX.read(b, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const filas = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false, raw: false })
    return filas.map((f) => (f ?? []).map((c) => (c == null ? '' : String(c))))
      .filter((f) => f.some((c) => c.trim() !== ''))
  }
  const texto = b.toString('utf-8').replace(/^﻿/, '')
  const primeraLinea = texto.split(/\r?\n/, 1)[0] ?? ''
  return parsearCSV(texto, detectarSeparador(primeraLinea))
}
