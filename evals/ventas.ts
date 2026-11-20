/**
 * Harness de evaluación de VENTAS / CIERRE del agente (Nina).
 *
 * No mide solo si informa: mide si AVANZA la venta y CIERRA o DERIVA cuando el
 * lead está caliente. Simula conversaciones multi-turno reales contra el cerebro
 * (extraer → buscarProductos → conversar) sin tocar la DB, y las puntúa con un
 * LLM-juez (DeepSeek) según una rúbrica comercial. Respeta MODO_VENTA.
 *
 * Correr:  npx tsx evals/ventas.ts            (usa MODO_VENTA del entorno)
 *          MODO_VENTA=derivar npx tsx evals/ventas.ts
 * Requiere las keys de .env.local (DeepSeek + Supabase + Gemini para el catálogo).
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

import { extraer } from '../lib/core/extraer'
import { buscarProductos } from '../lib/core/catalogo'
import { conversar, modoVenta, type ModoVenta } from '../lib/core/conversar'
import type { Turno } from '../lib/core/historial'

type Espera = 'cierre' | 'derivar' | 'informar_no_forzar'
type Escenario = { id: string; desc: string; turnos: string[]; espera: Espera }

// Cliente "scripteado": cada string es un mensaje del cliente, en orden.
const ESCENARIOS: Escenario[] = [
  {
    id: 'comprador-directo',
    desc: 'Cliente con intención clara desde el primer mensaje',
    espera: 'cierre',
    turnos: ['hola, quiero aceite de coco', '¿cuánto cuesta?', 'ok dame 2', 'pago con yape, estoy en Surco'],
  },
  {
    id: 'objecion-precio',
    desc: 'Cliente interesado que objeta el precio',
    espera: 'cierre',
    turnos: ['tienen miel de abeja?', 'uy está cara', 'mmm ok, y es realmente orgánica?', 'ya, la llevo'],
  },
  {
    id: 'caliente-pide-pago',
    desc: 'Lead caliente que pregunta cómo pagar',
    espera: 'derivar',
    turnos: ['quiero 3 bolsas de café orgánico', 'cómo te pago?'],
  },
  {
    id: 'curioso-frio',
    desc: 'Curioso sin intención: no hay que presionar ni inventar',
    espera: 'informar_no_forzar',
    turnos: ['hola', 'qué venden?', 'ah ok, gracias'],
  },
  {
    id: 'producto-inexistente',
    desc: 'Pide algo que no está en catálogo: honestidad, sin alucinar',
    espera: 'informar_no_forzar',
    turnos: ['tienen laptops gamer?', 'y celulares?'],
  },
  {
    id: 'indeciso-cerrable',
    desc: 'Interesado que duda entre opciones: hay que recomendar y cerrar',
    espera: 'cierre',
    turnos: ['busco algo para la energía en la mañana', 'cuáles tienen?', 'cuál me recomiendas?', 'ya esa'],
  },
]

async function correr(esc: Escenario, modo: ModoVenta) {
  const historial: Turno[] = []
  let foco: string | null = null
  let ultimo = { etapa: '', derivar: false, score: 0 }
  for (const msg of esc.turnos) {
    const pedido = await extraer(msg, historial.slice(-4))
    if (pedido.producto) foco = pedido.producto
    const matches = await buscarProductos(foco)
    const conv = await conversar({ mensaje: msg, historial, matches, modo })
    historial.push({ rol: 'cliente', texto: msg }, { rol: 'bot', texto: conv.respuesta })
    ultimo = { etapa: conv.etapa, derivar: conv.derivar, score: conv.score }
  }
  return { historial, ultimo }
}

type Rubrica = {
  avance_embudo: number
  accion_comercial: number
  grounding: number
  objeciones: number
  naturalidad: number
  resultado: string
  correcto_para_el_modo: boolean
  comentario: string
  sugerencia: string
}

async function juzgar(esc: Escenario, historial: Turno[], modo: ModoVenta): Promise<Rubrica> {
  const key = process.env.DEEPSEEK_API_KEY
  const model = process.env.LLM_MODEL || 'deepseek-chat'
  const transcript = historial.map((t) => `${t.rol === 'cliente' ? 'CLIENTE' : 'NINA'}: ${t.texto}`).join('\n')
  const metaModo =
    modo === 'derivar'
      ? 'En modo DERIVAR, "accion_comercial" mide si derivó al asesor a tiempo (apenas el lead se puso caliente), SIN intentar cerrar el pedido él mismo.'
      : 'En modo CIERRE, "accion_comercial" mide si intentó cerrar (recap producto×cantidad=total, pidió la venta, cierre alternativo) y derivó al confirmar.'
  const sys = `Sos un evaluador experto de agentes de ventas por WhatsApp. Puntuás 0-10 (10=excelente).
El objetivo del agente NO es solo informar: es AVANZAR y CERRAR la venta, o DERIVAR al humano si el lead
está caliente, sin inventar datos. ${metaModo}
Devolvé SOLO JSON: {"avance_embudo":n,"accion_comercial":n,"grounding":n,"objeciones":n,"naturalidad":n,
"resultado":"cerro|derivo|informo_sin_avanzar|perdio_venta|bloqueo_troll","correcto_para_el_modo":bool,
"comentario":"1 frase","sugerencia":"1 mejora concreta del prompt"}.
Criterios: avance_embudo=progreso hacia la compra; grounding=precios/stock reales y nada inventado;
objeciones=manejo con valor (si hubo); naturalidad=conciso, WhatsApp, sin interrogatorio.`
  const userMsg = `MODO=${modo}. ESCENARIO: ${esc.desc} (esperado: ${esc.espera}).\n\nCONVERSACIÓN:\n${transcript}`
  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }],
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  })
  const data = await r.json()
  return JSON.parse(data.choices[0].message.content)
}

async function main() {
  const modo = modoVenta()
  console.log(`\n=== EVAL DE VENTAS · modo=${modo} · modelo=${process.env.LLM_MODEL || 'deepseek-chat'} ===\n`)
  const filas: { id: string; r: Rubrica; ok: boolean }[] = []
  for (const esc of ESCENARIOS) {
    try {
      const { historial, ultimo } = await correr(esc, modo)
      const r = await juzgar(esc, historial, modo)
      const ok = r.correcto_para_el_modo
      filas.push({ id: esc.id, r, ok })
      const prom = ((r.avance_embudo + r.accion_comercial + r.grounding + r.objeciones + r.naturalidad) / 5).toFixed(1)
      console.log(`${ok ? '✅' : '❌'} ${esc.id}  [${prom}/10]  resultado=${r.resultado}  (último: etapa=${ultimo.etapa}, derivar=${ultimo.derivar}, score=${ultimo.score})`)
      console.log(`   embudo:${r.avance_embudo} comercial:${r.accion_comercial} grounding:${r.grounding} objeciones:${r.objeciones} natural:${r.naturalidad}`)
      console.log(`   ${r.comentario}`)
      console.log(`   → ${r.sugerencia}\n`)
    } catch (e) {
      console.log(`⚠️  ${esc.id}: error ${(e as Error).message}\n`)
    }
  }
  const n = filas.length
  if (n) {
    const avg = (sel: (r: Rubrica) => number) => (filas.reduce((s, f) => s + sel(f.r), 0) / n).toFixed(1)
    const aciertos = filas.filter((f) => f.ok).length
    console.log('=== RESUMEN ===')
    console.log(`Correcto para el modo: ${aciertos}/${n}`)
    console.log(`Promedios → embudo:${avg((r) => r.avance_embudo)} comercial:${avg((r) => r.accion_comercial)} grounding:${avg((r) => r.grounding)} objeciones:${avg((r) => r.objeciones)} natural:${avg((r) => r.naturalidad)}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
