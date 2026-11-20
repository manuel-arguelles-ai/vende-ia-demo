/**
 * Demo OFFLINE del núcleo: ejecuta el `procesar()` REAL (extraer → puntuar → guardar → catálogo)
 * sin credenciales, inyectando dependencias deterministas (reglas en vez de LLM, memoria en vez de
 * Supabase) a través del parámetro `deps` que `procesar()` ya expone.
 *
 *   npm run demo
 *
 * Todos los datos son sintéticos. Las reglas de extracción/scoring son una simulación simple;
 * en producción esos dos pasos los hace un LLM (lib/core/extraer.ts y lib/core/puntuar.ts).
 */
import { procesar } from '../lib/core/procesar'
import { temperaturaDe } from '../lib/core/atender'
import type { Pedido, PedidoGuardado, Scoring } from '../lib/core/schemas'
import type { ProductoMatch } from '../lib/core/catalogo'

const CATALOGO: ProductoMatch[] = [
  { nombre: 'Aceite de coco 500 ml', marca: 'Demo', precio: 49, presentacion: 'frasco', stock: 12, categoria: 'alimentación', descripcion: null, confianza: 'alta' },
  { nombre: 'Miel de abeja 350 g', marca: 'Demo', precio: 28, presentacion: 'frasco', stock: 0, categoria: 'alimentación', descripcion: null, confianza: 'alta' },
  { nombre: 'Kombucha jengibre 330 ml', marca: 'Demo', precio: 9, presentacion: 'botella', stock: 40, categoria: 'bebidas', descripcion: null, confianza: 'alta' },
]

const extraer = async (mensaje: string): Promise<Pedido> => {
  const m = mensaje.toLowerCase()
  const prod = CATALOGO.find((p) => m.includes(p.nombre.split(' ')[0].toLowerCase()))
  const cant = m.match(/\b(\d+)\b/)
  return {
    producto: prod ? prod.nombre.split(' ')[0].toLowerCase() : null,
    color: null, talla: null,
    cantidad: cant ? parseInt(cant[1], 10) : null,
    extra: {},
    necesita_aclaracion: !prod,
  }
}

const puntuar = async (mensaje: string, pedido: Pedido): Promise<Scoring> => {
  const m = mensaje.toLowerCase()
  let score = pedido.producto ? 25 : 5
  const senales: string[] = []
  const suma = (re: RegExp, pts: number, txt: string) => { if (re.test(m)) { score += pts; senales.push(txt) } }
  suma(/precio|cu[aá]nto|stock|hay\b/, 20, 'pregunta precio/stock')
  suma(/yape|transferencia|tarjeta|pago|pagar/, 20, 'habla de forma de pago')
  suma(/lo quiero|quiero|necesito|urgente|hoy/, 20, 'intención/urgencia explícita')
  suma(/env[ií]o|direcci[oó]n|recoger|delivery/, 15, 'datos de entrega')
  if (pedido.cantidad) { score += 10; senales.push('cantidad concreta') }
  score = Math.min(100, score)
  return { score, temperatura: temperaturaDe(score), razon: senales.join('; ') || 'sin señales de compra' }
}

const memoria: PedidoGuardado[] = []
const insertPedido = async (row: PedidoGuardado): Promise<PedidoGuardado> => {
  const saved = { ...row, id: memoria.length + 1, created_at: new Date().toISOString() }
  memoria.push(saved)
  return saved
}
const buscarProducto = async (nombre: string | null) =>
  CATALOGO.find((p) => nombre && p.nombre.toLowerCase().startsWith(nombre.toLowerCase())) ?? null

const MENSAJES: Array<[string, 'whatsapp' | 'simulador']> = [
  ['Hola, ¿qué tipo de cosas venden?', 'simulador'],
  ['cuánto cuesta el aceite de coco?', 'whatsapp'],
  ['Quiero 2 kombucha, ¿puedo pagar por yape y que me lo envíen hoy?', 'whatsapp'],
  ['necesito miel, hay stock? lo quiero para hoy', 'simulador'],
]

async function main() {
  console.log('vende-ia · demo offline de procesar() (reglas deterministas, sin LLM ni base de datos)\n')
  let i = 0
  for (const [mensaje, canal] of MENSAJES) {
    const r = await procesar(
      { mensaje, canal, remitente: `5190000000${++i}` },
      { extraer, puntuar, insertPedido, buscarProducto },
    )
    const emoji = { caliente: 'CALIENTE', tibio: 'tibio', frio: 'frio' }[r.temperatura]
    console.log(`[${canal}] "${mensaje}"`)
    console.log(`   producto=${r.producto ?? '-'} cantidad=${r.cantidad ?? '-'} | score=${r.score} (${emoji}) | derivar=${r.derivar}`)
    console.log(`   razón: ${r.razon}`)
    console.log(`   catálogo: ${r.match ? `${r.match.nombre} S/${r.match.precio} stock=${r.match.stock}` : 'sin coincidencia'}\n`)
  }
  const calientes = memoria.filter((p) => p.derivar).length
  console.log(`Guardados ${memoria.length} pedidos en memoria; ${calientes} derivados a un asesor humano.`)
  if (memoria.length !== MENSAJES.length || calientes < 1) { console.error('FALLO: resultado inesperado'); process.exit(1) }
}
main()
