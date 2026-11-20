'use client'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Sparkles, Store, Phone, ExternalLink, ArrowRight, Search } from 'lucide-react'
import { telefonoMostrado } from '@/lib/core/handoff'
import { telefonoLead } from '@/lib/ui/lead'
import { filtrarPedidos, type FiltrosPedidos } from '@/lib/core/filtros-pedidos'
import { conBase } from '@/lib/base'
import { useToast } from './toast'
import { Select } from './select'
import type { PedidoGuardado } from '@/lib/core/schemas'
import type { Conversacion } from '@/lib/core/conversaciones'
import type { Cierre } from '@/lib/core/gestion'

type TiendaOpc = { id: number; nombre: string }

// Estado de PEDIDO (transaccional) mapeado desde el estado del cierre real.
// Solo existen ganado/reservada/perdido en el modelo; Preparando/Entregado
// quedan definidos por si más adelante hay un campo que los respalde.
const ESTADO_PEDIDO: Record<string, { label: string; cls: string }> = {
  ganado: { label: 'Pagado', cls: 'bg-[#E1F5EE] text-[#0F6E56]' },
  reservada: { label: 'Pendiente de pago', cls: 'bg-[#FAEEDA] text-[#854F0B]' },
  perdido: { label: 'Cancelado', cls: 'bg-[#FCEBEB] text-[#A32D2D]' },
  // preparando: { label: 'Preparando', cls: 'bg-[#E6F1FB] text-[#185FA5]' },
  // entregado: { label: 'Entregado', cls: 'bg-[#F1EFE8] text-[#5F5E5A]' },
}
const INTENCION: Record<string, string> = { caliente: 'Intención alta', tibio: 'Intención media', frio: 'Intención baja' }

// Segmento por tipo, persistido en localStorage (SSR-safe, sin setState en effect).
type Seg = 'todos' | 'pedidos' | 'senales'
const SKEY = 'pedidos-seg'
const segListeners = new Set<() => void>()
function subSeg(cb: () => void) { segListeners.add(cb); return () => { segListeners.delete(cb) } }
function getSeg(): Seg { try { const v = localStorage.getItem(SKEY); return v === 'pedidos' || v === 'senales' ? v : 'todos' } catch { return 'todos' } }
function setSegStore(v: Seg) { try { localStorage.setItem(SKEY, v) } catch {}; segListeners.forEach((l) => l()) }

function ChipTipo({ pedido }: { pedido: boolean }) {
  return pedido ? (
    <span className="rounded-full border-[0.5px] border-[#ececf2] bg-[#f5f5fa] px-2 py-0.5 text-[11px] font-semibold text-muted">Pedido</span>
  ) : (
    <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-semibold text-[#0E7490]">Señal</span>
  )
}

export function Panel({
  pedidos,
  convs = [],
  onAbrirEnPipeline,
}: {
  pedidos: PedidoGuardado[]
  convs?: Conversacion[]
  onAbrirEnPipeline?: (remitente: string) => void
}) {
  const [tiendas, setTiendas] = useState<TiendaOpc[]>([])
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [estado, setEstado] = useState<'' | 'nuevo' | 'derivado'>('')
  const [tiendaId, setTiendaId] = useState('')
  const [texto, setTexto] = useState('')
  const seg = useSyncExternalStore(subSeg, getSeg, () => 'todos' as Seg)
  const toast = useToast()
  const hayFiltro = !!(desde || hasta || estado || tiendaId || texto)
  const borrar = () => { setDesde(''); setHasta(''); setEstado(''); setTiendaId(''); setTexto('') }

  useEffect(() => {
    fetch(conBase('/api/tiendas')).then((r) => (r.ok ? r.json() : [])).then(setTiendas).catch(() => {})
  }, [])

  // Cierre por remitente (de las conversaciones, que ya traen tipo/monto/tienda_id).
  const cierrePorRem = useMemo(
    () => new Map(convs.filter((c) => c.cierre).map((c) => [c.remitente, c.cierre!])),
    [convs],
  )
  const tiendaNombre = useMemo(() => new Map(tiendas.map((t) => [t.id, t.nombre])), [tiendas])
  const esPedido = (rem: string) => cierrePorRem.has(rem)

  const base = useMemo(() => {
    const f: FiltrosPedidos = {
      desde: desde ? `${desde}T00:00:00Z` : null,
      hasta: hasta ? `${hasta}T23:59:59Z` : null,
      estado: estado || undefined,
      tiendaId: tiendaId ? Number(tiendaId) : undefined,
      texto: texto || undefined,
    }
    return filtrarPedidos(pedidos, cierrePorRem, f)
  }, [pedidos, cierrePorRem, desde, hasta, estado, tiendaId, texto])

  // Segmentación pedido/señal según presencia de cierre (no rompe filtrarPedidos).
  const filtrados = useMemo(() => {
    if (seg === 'pedidos') return base.filter((p) => esPedido(p.remitente))
    if (seg === 'senales') return base.filter((p) => !esPedido(p.remitente))
    return base
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, seg, cierrePorRem])

  // Dedupe por remitente: 1 tarjeta por lead (venta = 1 tarjeta; señal = la más
  // reciente + contador). Reduce ruido, no datos. Ordena por actividad reciente.
  const agrupados = useMemo(() => {
    const grupos = new Map<string, { rep: PedidoGuardado; count: number; pedido: boolean }>()
    for (const p of filtrados) {
      const g = grupos.get(p.remitente)
      if (!g) grupos.set(p.remitente, { rep: p, count: 1, pedido: cierrePorRem.has(p.remitente) })
      else {
        g.count++
        if ((p.created_at ?? '') > (g.rep.created_at ?? '')) g.rep = p // representativa = más reciente
      }
    }
    return [...grupos.values()].sort((a, b) => (b.rep.created_at ?? '').localeCompare(a.rep.created_at ?? ''))
  }, [filtrados, cierrePorRem])

  // Total de leads (remitentes) para el contador "X de Y" tras agrupar.
  const totalLeads = useMemo(() => new Set(pedidos.map((p) => p.remitente)).size, [pedidos])

  function convertir(rem: string) {
    // El flujo real de cierre (monto/estado) vive en el copiloto del Pipeline.
    toast.ok('Cierra la venta desde el copiloto del lead en el Pipeline.')
    onAbrirEnPipeline?.(rem)
  }

  // Misma altura/borde/radio EXACTOS que el <Select> de la fila (h-9, border 0.5px,
  // rounded-lg). height fija manda; sin padding-y y con leading-none para que no infle.
  const inputCls = 'box-border h-9 rounded-lg border-[0.5px] border-[#f0f0f3] bg-card px-3 py-0 text-sm leading-none text-ink outline-none transition placeholder:text-muted focus:border-coral'
  const SEGS: [Seg, string][] = [['todos', 'Todos'], ['pedidos', 'Pedidos'], ['senales', 'Señales']]

  return (
    <div className="space-y-4">
      {/* Control segmentado por tipo */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-0.5 rounded-full border border-line bg-card p-0.5">
          {SEGS.map(([v, label]) => (
            <button
              key={v}
              onClick={() => setSegStore(v)}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                seg === v ? 'bg-coral-soft text-[#0E7490]' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">{agrupados.length} de {totalLeads}</span>
      </div>

      {/* Filtros (sin caja): buscador a la izquierda, grupo de filtros anclado a la derecha) */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full min-w-0 lg:max-w-[480px] lg:flex-1">
          <Search size={16} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por número o producto…"
            className="h-9 w-full rounded-full border border-line bg-card pl-9 pr-3.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-coral"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <label className="flex items-center gap-1.5 text-xs text-muted">Desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inputCls} /></label>
          <label className="flex items-center gap-1.5 text-xs text-muted">Hasta<input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inputCls} /></label>
          <Select
            ariaLabel="Estado del pedido"
            value={estado}
            onChange={(v) => setEstado(v as typeof estado)}
            options={[{ value: '', label: 'Estado: todos' }, { value: 'nuevo', label: 'Nuevo' }, { value: 'derivado', label: 'Derivado' }]}
          />
          {tiendas.length > 0 && (
            <Select
              ariaLabel="Tienda"
              value={tiendaId}
              onChange={setTiendaId}
              options={[{ value: '', label: 'Tienda: todas' }, ...tiendas.map((t) => ({ value: String(t.id), label: t.nombre }))]}
            />
          )}
          {hayFiltro && <button onClick={borrar} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-ink">✕ Borrar filtros</button>}
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {agrupados.map(({ rep: p, count, pedido }, i) => {
          const cierre = cierrePorRem.get(p.remitente) as Cierre | undefined
          const producto = [p.cantidad ? `${p.cantidad}×` : '', p.producto, p.color, p.talla].filter(Boolean).join(' ') || '—'
          const tel = telefonoLead(telefonoMostrado(p.remitente, p.extra as Record<string, unknown>))
          const tienda = cierre?.tienda_id ? tiendaNombre.get(cierre.tienda_id) : undefined
          const estadoBadge = cierre ? ESTADO_PEDIDO[cierre.estado] : undefined
          return (
            <div
              key={p.id ?? i}
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
              className="anim-subir rounded-xl border-[0.5px] border-[#f0f0f3] bg-card p-4 shadow-[0_1px_2px_rgba(33,31,26,0.04)]"
            >
              {/* Fila 1: tipo + estado (izq) · monto héroe (der, solo pedido) */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <ChipTipo pedido={pedido} />
                  {!pedido && count > 1 && (
                    <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[11px] font-semibold text-muted" title="Señales agrupadas de este lead">{count} señales</span>
                  )}
                  {estadoBadge && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${estadoBadge.cls}`}>{estadoBadge.label}</span>}
                  {p.score != null && (
                    <span className="rounded-full bg-coral-soft px-1.5 py-0.5 text-[10px] font-semibold text-[#0E7490]">Score IA {p.score}</span>
                  )}
                </div>
                {pedido && cierre?.monto != null && (
                  <span className="flex-shrink-0 text-[18px] font-medium leading-none text-ink">S/ {Number(cierre.monto).toFixed(2)}</span>
                )}
              </div>

              {/* Producto */}
              <p className="mt-2 truncate font-semibold text-ink">{producto}</p>

              {/* Meta line: teléfono · canal · tienda */}
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1"><Phone size={13} strokeWidth={1.75} aria-hidden /> {tel}</span>
                <span>· {p.canal}</span>
                {tienda && <span className="inline-flex items-center gap-1">· <Store size={13} strokeWidth={1.75} aria-hidden /> {tienda}</span>}
              </p>

              {/* Última señal (mensaje del cliente): solo en Señales — en Pedidos
                  el monto real ya está arriba y este texto (comprobante) compite. */}
              {!pedido && p.mensaje_crudo && <p className="mt-1.5 truncate text-[13px] text-muted">“{p.mensaje_crudo}”</p>}

              {/* Recomendación IA (solo señales) */}
              {!pedido && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-[#E6FBFD] px-2.5 py-1.5 text-[12.5px] leading-snug text-[#0E7490]">
                  <Sparkles size={14} strokeWidth={1.75} aria-hidden className="mt-0.5 flex-shrink-0" />
                  <span><span className="font-semibold">{INTENCION[p.temperatura] ?? 'Intención'}</span> — {p.razon}</span>
                </div>
              )}

              {/* Acciones */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!pedido ? (
                  <>
                    <button
                      onClick={() => convertir(p.remitente)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-1.5 text-xs font-bold text-white transition hover:brightness-95"
                    >
                      Convertir a pedido <ArrowRight size={14} strokeWidth={2} aria-hidden />
                    </button>
                    <button
                      onClick={() => onAbrirEnPipeline?.(p.remitente)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
                    >
                      Ver en Pipeline <ExternalLink size={13} strokeWidth={1.75} aria-hidden />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onAbrirEnPipeline?.(p.remitente)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
                  >
                    Ver en Pipeline <ExternalLink size={13} strokeWidth={1.75} aria-hidden />
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {agrupados.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            {pedidos.length ? 'Nada con esos filtros.' : 'Esperando pedidos…'}
          </p>
        )}
      </div>
    </div>
  )
}
