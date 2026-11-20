import { extraer as extraerReal } from './extraer'
import { puntuar as puntuarReal } from './puntuar'
import { insertPedido as insertReal } from './db'
import { buscarProducto as buscarReal, type ProductoMatch } from './catalogo'
import type { PedidoGuardado } from './schemas'

export type ProcesarInput = {
  mensaje: string
  canal: 'whatsapp' | 'simulador'
  remitente: string
}

// El pedido guardado + el producto del catálogo que matcheó (precio/stock real).
export type PedidoConMatch = PedidoGuardado & { match: ProductoMatch | null }

type Deps = {
  extraer: typeof extraerReal
  puntuar: typeof puntuarReal
  insertPedido: typeof insertReal
  buscarProducto: typeof buscarReal
}

export async function procesar(
  input: ProcesarInput,
  deps: Deps = {
    extraer: extraerReal,
    puntuar: puntuarReal,
    insertPedido: insertReal,
    buscarProducto: buscarReal,
  },
): Promise<PedidoConMatch> {
  const pedido = await deps.extraer(input.mensaje)
  const scoring = await deps.puntuar(input.mensaje, pedido)
  const row: PedidoGuardado = {
    ...pedido,
    ...scoring,
    canal: input.canal,
    remitente: input.remitente,
    mensaje_crudo: input.mensaje,
    derivar: scoring.temperatura === 'caliente',
    estado: 'nuevo',
  }
  const saved = await deps.insertPedido(row)
  // Lookup en el catálogo (por SQL, sin tokens). No bloquea si falla.
  let match: ProductoMatch | null = null
  try {
    match = await deps.buscarProducto(pedido.producto)
  } catch {
    match = null
  }
  return { ...saved, match }
}
