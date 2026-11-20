import { z } from 'zod'

export const PedidoSchema = z.object({
  producto: z.string().nullable(),
  color: z.string().nullable(),
  talla: z.string().nullable(),
  cantidad: z.number().int().nullable(),
  extra: z.record(z.string(), z.any()).default({}),
  necesita_aclaracion: z.boolean(),
})
export type Pedido = z.infer<typeof PedidoSchema>

export const ScoringSchema = z.object({
  temperatura: z.enum(['caliente', 'tibio', 'frio']),
  score: z.number().int().min(0).max(100),
  razon: z.string(),
})
export type Scoring = z.infer<typeof ScoringSchema>

// Salida del agente conversacional (multi-turno): respuesta + estado del lead.
export const ETAPAS = [
  'enganche', 'descubrimiento', 'recomendacion', 'objecion', 'cierre', 'derivacion',
] as const
export const ConversacionSchema = z.object({
  respuesta: z.string(),
  etapa: z.enum(ETAPAS),
  temperatura: z.enum(['caliente', 'tibio', 'frio']),
  score: z.number().int().min(0).max(100),
  razon: z.string(),
  derivar: z.boolean(),
  handoff: z.string().nullable(),
  // Auto-etiquetas accionables sobre el cliente (ej "pide factura", "mayorista").
  // Opcional para tolerar modelos que no lo devuelvan.
  etiquetas: z.array(z.string()).max(3).optional().default([]),
  // Cierre con tienda: el modelo lo emite SOLO cuando el cliente eligió forma
  // (venta=paga+recoge / reserva=aparta y paga en tienda) y una tienda concreta.
  // El código valida tienda+stock antes de registrarlo (atender).
  cierre: z.object({ tipo: z.enum(['venta', 'reserva']), tienda: z.string() }).nullable().optional(),
})
export type Conversacion = z.infer<typeof ConversacionSchema>

// Lo que se guarda y se devuelve (pedido + scoring + metadatos del canal)
export type PedidoGuardado = Pedido & Scoring & {
  id?: string | number
  created_at?: string
  canal: 'whatsapp' | 'simulador' | 'web'
  remitente: string
  mensaje_crudo: string
  derivar: boolean
  estado: 'nuevo' | 'derivado'
}
