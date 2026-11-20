# Evals — Harness de ventas / cierre

Mide qué tan bien **vende** el agente, no solo si informa: si **avanza el embudo** y
**cierra** o **deriva** cuando el lead está caliente, sin inventar datos.

## Correr
```bash
# usa MODO_VENTA del entorno (default: cierre)
npx tsx evals/ventas.ts

# forzar un modo
MODO_VENTA=derivar npx tsx evals/ventas.ts
```
Requiere las keys de `.env.local` (DeepSeek para agente+juez, Supabase+Gemini para el catálogo).
Simula conversaciones reales contra el cerebro (`extraer → buscarProductos → conversar`)
**sin escribir en la base** (no ensucia el CRM).

## Qué evalúa (rúbrica 0-10, LLM-juez)
- **avance_embudo** — progreso hacia la compra (no se quedó en informar).
- **accion_comercial** — en modo `cierre`: intentó cerrar (recap, pedir la venta); en modo `derivar`: derivó al asesor a tiempo.
- **grounding** — precios/stock reales, nada inventado.
- **objeciones** — manejo con valor.
- **naturalidad** — conciso, estilo WhatsApp, sin interrogatorio.

Más `correcto_para_el_modo` (bool), `resultado` (cerro/derivo/informo_sin_avanzar/…),
comentario y una sugerencia concreta de mejora del prompt.

## Cómo usarlo
- **Gate de calidad:** corré el harness antes de publicar cualquier cambio del prompt
  (`lib/core/conversar.ts`). Si baja `accion_comercial` o `correcto_para_el_modo`, no publiques.
- **Baseline:** guardá el resumen para comparar versiones del prompt.

## Modos de venta (`MODO_VENTA`)
- `cierre` — el agente lleva la venta hasta el pedido confirmado y deriva para cobro/envío.
- `derivar` — el agente atiende e informa, y deriva al asesor humano apenas el lead está caliente (no cierra él).

Se configura por variable de entorno (en Dokploy: Environment del servicio).
Agregar escenarios nuevos en `ESCENARIOS` dentro de `ventas.ts`.
