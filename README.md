# vende-ia

SaaS multi-inquilino que convierte conversaciones de WhatsApp en **datos estructurados**, les asigna un **scoring de lead** y **deriva** a un asesor humano cuando el cliente está listo para comprar, con un dashboard en vivo para el equipo comercial.

> Todo el contenido de este repositorio (catálogo, nombres de negocio, números, correos) es sintético. "Tienda Demo" y "Nina" son nombres ficticios.

## Qué problema resuelve

Un negocio pequeño vende por WhatsApp: los pedidos llegan como texto libre ("tienes aceite de coco? cuánto sale, lo quiero para hoy"), mezclados con curiosos, y nadie sabe a quién llamar primero. vende-ia:

1. **Estructura** cada mensaje (producto, cantidad, datos sueltos) con un LLM.
2. **Contrasta** con el catálogo del negocio (precio y stock reales, búsqueda híbrida en Postgres).
3. **Puntúa** al lead (0-100) y lo clasifica como frío, tibio o caliente.
4. **Responde** como agente de ventas (cierra o informa, según `MODO_VENTA`) y **deriva** al asesor cuando el lead se calienta.
5. **Muestra** todo en un dashboard: pipeline, conversaciones, contactos, pedidos, KPIs, alertas y copiloto del asesor.

## Arquitectura

```
 WhatsApp real ──► worker/ (Node 24/7, Baileys) ─┐
                                                 ├──► lib/core  atender() / procesar()  ──► Supabase (Postgres + RLS)
 Simulador web ──► POST /api/procesar (Next.js) ─┘          │                                    ▲
 Widget web    ──► POST /api/widget/chat                    └─► LLM (API compatible con OpenAI)   │
                                                                                 Dashboard Next.js (lee Supabase)
```

### Patrón: un núcleo compartido, dos puertas de entrada

Toda la lógica del agente vive en `lib/core/` y **no sabe de qué canal viene el mensaje**. Las "puertas" solo traducen su protocolo y llaman al núcleo con `canal: 'whatsapp' | 'simulador' | 'web'`:

- **Puerta 1, WhatsApp real:** `worker/` mantiene los sockets de Baileys (una sesión por inquilino), transcribe notas de voz si hay STT y llama a `atender()`.
- **Puerta 2, simulador web:** la ruta `app/api/procesar/route.ts` llama a la **misma** función `atender()` desde el dashboard, para probar al agente sin teléfono.

Hay dos niveles del núcleo:

- `procesar()` (`lib/core/procesar.ts`): el pipeline original de un solo turno, **extraer → puntuar → guardar → buscar en catálogo**. Recibe sus dependencias por inyección, por eso es fácil de probar y de ejecutar sin red (ver el demo offline).
- `atender()` (`lib/core/atender.ts`): la evolución multi-turno que usan hoy ambas puertas. Añade historial y memoria de la conversación, guardrails anti-inyección, antifraude de comprobantes de pago, cierre por tienda (venta o reserva), límites por plan, takeover humano y etiquetas automáticas.

### Scoring de lead

- El LLM devuelve `score` (0-100) y una `razon` breve a partir de señales de compra: pregunta precio/stock, habla de forma de pago, da datos de entrega, muestra urgencia, indica cantidad.
- **La temperatura no la decide el LLM**: se deriva del score con bandas fijas en `temperaturaDe()` (`lib/core/atender.ts`), porque el modelo a veces contradice su propio número:

| Score | Temperatura |
|---|---|
| 0-25 | frío |
| 26-60 | tibio |
| 61-100 | caliente (deriva a asesor) |

- Un turno "troll" no destruye el score ni el producto de un comprador que venía caliente.

### Multi-inquilino

Cada fila lleva `tenant_id`, hay RLS en Postgres, sesiones firmadas con HMAC, roles (admin, asesor) con visibilidad por lead, motor de asignación (manual, round-robin, ponderado, por carga), planes con límites de consumo y una consola de superadmin. Los esquemas SQL están en `supabase/`.

## Cómo correrlo sin credenciales

Requisitos: Node 22+.

```bash
npm install
npm test        # 689 tests unitarios, sin red ni credenciales
npm run demo    # ejecuta procesar() de verdad con dependencias simuladas
```

`npm run demo` (`demo/offline.ts`) inyecta en `procesar()` un extractor y un puntuador **por reglas** (en lugar del LLM), un catálogo en memoria y un almacén en memoria (en lugar de Supabase) y procesa cuatro mensajes sintéticos por las dos puertas (`whatsapp` y `simulador`). Verifica el flujo, el scoring por bandas y la derivación; **no** demuestra la calidad del LLM, porque las reglas son una simulación simple.

## Qué requiere el modo completo

El dashboard y el simulador web **sí necesitan credenciales**: el login, la persistencia y el agente dependen de ellas.

1. Un proyecto de Supabase: aplicar `supabase/schema.sql` y luego los demás scripts (`multitenant.sql`, `busqueda.sql`/`multitenant-busqueda.sql`, `productos.sql`, etc.).
2. Una API key de un LLM compatible con OpenAI (DeepSeek por defecto; también Gemini, Groq u otro endpoint vía `LLM_BASE_URL`).
3. Copiar `.env.example` a `.env.local` y completarlo (incluye `AUTH_SECRET`).
4. `npm run dev` abre el dashboard en http://localhost:3000.

Para **WhatsApp real**: `npm run worker`, escanear el QR con un **número dedicado y descartable**, y persistir `WA_AUTH_DIR` (volumen) para no volver a escanear. Las notas de voz son opcionales (Groq/OpenAI Whisper para STT, servicio Kokoro y `ffmpeg` para TTS). El cobro de suscripciones usa Mercado Pago y es opcional. Hay `Dockerfile` y `docker-compose.yml` (web + worker + TTS).

`evals/ventas.ts` es un arnés de evaluación con LLM-juez de la calidad comercial del agente (requiere credenciales; ver `evals/README.md`).

## Estructura

```
lib/core/    núcleo: extraer, puntuar, conversar, atender, guardrails, catálogo, billing...
worker/      puerta WhatsApp (Baileys), sesiones por inquilino, voz
app/         dashboard Next.js + rutas API (incluye /api/procesar, el simulador)
supabase/    esquema, RLS, búsqueda híbrida, migraciones
demo/        demo offline de procesar()
evals/       arnés de evaluación de ventas
public/      widget de chat embebible
```

## Límites honestos

- **Baileys no es oficial y viola los términos de uso de WhatsApp**: hay riesgo de bloqueo del número, alto con ráfagas de mensajes. Para producción real, la ruta correcta es la WhatsApp Cloud API oficial; el núcleo no cambiaría, pero **esa puerta no está implementada**.
- Es un proyecto de portafolio/demo: sin evaluación formal de la precisión de la extracción ni del scoring más allá de los tests y del arnés con LLM-juez.
- Orientado a Perú: moneda en soles, medios de pago Yape/Plin, zona horaria America/Lima, textos en español neutro.
- 26 tests de integración se omiten sin una base Supabase configurada.
- Los prompts y el catálogo de ejemplo son genéricos; un negocio real necesita cargar su catálogo y configurar su agente (nombre, tono, reglas).
- El scoring depende del modelo LLM elegido y no está calibrado contra ventas reales.

## Licencia

MIT. Ver [LICENSE](LICENSE).
