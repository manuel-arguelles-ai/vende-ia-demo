'use client'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { List, LayoutGrid, Sparkles, BookOpen, ChevronDown, ChevronLeft, ChevronRight, Upload } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { conBase } from '@/lib/base'
import { Select } from './select'

// Vista "Catálogo": navegador del catálogo completo con la búsqueda híbrida.
type Producto = {
  nombre: string
  marca: string | null
  precio: number | string
  presentacion: string | null
  stock: number
  seccion?: string | null
  categoria?: string | null
}

// Umbral de stock bajo (constante configurable).
const UMBRAL_STOCK_BAJO = 10

// Paginación (client-side sobre la lista ya cargada).
const POR_PAGINA = 24
function rangoPaginas(actual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const start = Math.max(2, actual - 1)
  const end = Math.min(total - 1, actual + 1)
  if (start > 2) out.push('…')
  for (let p = start; p <= end; p++) out.push(p)
  if (end < total - 1) out.push('…')
  out.push(total)
  return out
}
function badgeStock(n: number): { label: string; cls: string } {
  if (n <= 0) return { label: 'Agotado', cls: 'bg-[#FCEBEB] text-[#A32D2D]' }
  if (n <= UMBRAL_STOCK_BAJO) return { label: `Quedan ${n}`, cls: 'bg-[#FAEEDA] text-[#854F0B]' }
  return { label: `${n} en stock`, cls: 'bg-[#E1F5EE] text-[#0F6E56]' }
}

// Título legible: los datos vienen en MAYÚSCULAS del Excel; se normaliza SOLO
// para mostrar (no se toca el dato original). Preserva acrónimos/códigos con
// dígitos (CS6, MP3) y palabras ya mixtas (iPad); el resto pasa a capitalizado.
function tituloLegible(s: string): string {
  return s.split(/\s+/).map((w) => {
    if (!w) return w
    if (/\d/.test(w)) return w // códigos: CS6, MP3, 2024
    const lower = w.toLocaleLowerCase('es')
    const upper = w.toLocaleUpperCase('es')
    if (w !== lower && w !== upper) return w // mixto original (iPad)
    return upper.slice(0, 1) + lower.slice(1)
  }).join(' ')
}


// Tinte determinista por categoría para el placeholder de portada.
const TINTES: [string, string][] = [
  ['#CFFAFE', '#0E7490'], ['#E1F5EE', '#0F6E56'], ['#FAEEDA', '#854F0B'], ['#E6F1FB', '#185FA5'], ['#EEEDFE', '#3C3489'],
]
function tinteCat(cat?: string | null): [string, string] {
  if (!cat) return ['#F5F5FA', '#8181A5']
  let h = 0
  for (const c of cat) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TINTES[h % TINTES.length]
}
function Portada({ cat, className }: { cat?: string | null; className?: string }) {
  const [bg, fg] = tinteCat(cat)
  return (
    <span className={`grid place-items-center ${className ?? ''}`} style={{ background: bg, color: fg }}>
      <BookOpen size={20} strokeWidth={1.5} aria-hidden />
    </span>
  )
}

// Botón "Compartir": acción secundaria discreta. Reposo = transparente con
// borde tint cian + texto cian; hover/focus = relleno cian sólido, texto blanco.
// Compacto (auto-width), no protagonista: título y precio mandan en la card.
const BTN_COMPARTIR =
  'inline-flex items-center justify-center gap-1.5 rounded-full border-[0.5px] border-coral-soft text-coral outline-none transition-colors duration-150 hover:border-coral hover:bg-coral hover:text-white focus-visible:border-coral focus-visible:bg-coral focus-visible:text-white focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-1'

// Preferencia Lista/Grid persistida (SSR-safe, sin setState en effect). Default grid.
type Vista = 'lista' | 'grid'
const VKEY = 'catalogo-vista'
const vListeners = new Set<() => void>()
function subVista(cb: () => void) { vListeners.add(cb); return () => { vListeners.delete(cb) } }
function getVista(): Vista { try { return localStorage.getItem(VKEY) === 'lista' ? 'lista' : 'grid' } catch { return 'grid' } }
function setVistaStore(v: Vista) { try { localStorage.setItem(VKEY, v) } catch {}; vListeners.forEach((l) => l()) }

export function CatalogoVista() {
  const [q, setQ] = useState('')
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [impExp, setImpExp] = useState(false) // acordeón import/export
  const [pagina, setPagina] = useState(1)
  const vista = useSyncExternalStore(subVista, getVista, () => 'grid' as Vista)

  // Import/Export state
  const [archivo, setArchivo] = useState<File | null>(null)
  const [resumen, setResumen] = useState<Record<string, unknown> | null>(null)
  const [modo, setModo] = useState<'actualizar' | 'reemplazar'>('actualizar')
  const [trabajando, setTrabajando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      setCargando(true)
      try {
        const res = await fetch(conBase(`/api/catalogo?q=${encodeURIComponent(q)}`))
        if (res.ok) setProductos(await res.json())
      } finally {
        setCargando(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  async function preview(file: File, m: 'actualizar' | 'reemplazar') {
    const fd = new FormData(); fd.append('file', file); fd.append('modo', m)
    const r = await fetch(conBase('/api/catalogo/importar/preview'), { method: 'POST', body: fd })
    setResumen(r.ok ? await r.json() : null)
  }

  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setArchivo(file); setResultado(null)
    await preview(file, modo)
  }

  async function importar() {
    if (!archivo) return
    if (modo === 'reemplazar' && !confirm('Reemplazar todo tu catálogo actual. ¿Seguro?')) return
    setTrabajando(true)
    const fd = new FormData(); fd.append('file', archivo); fd.append('modo', modo)
    const r = await fetch(conBase('/api/catalogo/importar'), { method: 'POST', body: fd })
    const d = await r.json(); setTrabajando(false)
    setResultado(r.ok ? `Importados ${d.importados ?? 0}, actualizados ${d.actualizados ?? 0}, omitidas ${d.omitidas ?? 0}` : 'Error al importar')
  }

  async function mejorarIA() {
    const r = await fetch(conBase('/api/catalogo/enriquecer'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun: true }) })
    const s = await r.json()
    if (!confirm(`${s.sinDescripcion} sin descripción, ${s.sinGenero} sin género. ¿Autocompletar con IA?`)) return
    setTrabajando(true)
    const r2 = await fetch(conBase('/api/catalogo/enriquecer'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const d = await r2.json(); setTrabajando(false)
    setResultado(r2.ok ? `Enriquecidos ${d.enriquecidos ?? 0}` : 'Error al enriquecer')
  }

  // Compartir = acción real: manda la ficha del libro al chat (wa.me). No hay
  // flujo para asociar un producto a un pedido/cliente fuera del chat, así que
  // no existe "añadir a pedido" acá. "Reponer" abre el panel de Importar, que
  // es donde realmente se actualiza el stock (Excel/CSV) — acción real, no rebote.
  function compartir(p: Producto) {
    const t = `${tituloLegible(p.nombre)}${p.marca ? ` — ${p.marca}` : ''}\nS/ ${Number(p.precio).toFixed(2)}${p.stock > 0 ? '\nDisponible' : ''}`
    window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank', 'noopener')
  }
  const reponer = () => setImpExp(true)

  const cat = (p: Producto) => p.categoria ?? p.seccion ?? null

  // Paginación client-side (respeta la búsqueda/filtro ya aplicados en `productos`).
  const totalPaginas = Math.max(1, Math.ceil(productos.length / POR_PAGINA))
  const pag = Math.min(pagina, totalPaginas)
  const visibles = productos.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA)

  return (
    <div className="space-y-4">
      {/* Top bar: buscador IA + toggle + import/export */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-72 max-w-[560px]">
          <Sparkles size={16} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-coral" />
          <input
            className="w-full rounded-full border border-coral-soft bg-[#f0fcfd] py-2 pl-9 pr-3.5 text-sm outline-none transition placeholder:text-muted focus:border-coral focus:ring-2 focus:ring-coral/20"
            placeholder="Buscar con IA… (entiende necesidades: «algo para el estrés»)"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPagina(1) }}
          />
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-full border border-line bg-card p-0.5">
          {([['grid', 'Grid', LayoutGrid], ['lista', 'Lista', List]] as [Vista, string, typeof List][]).map(([v, label, Icono]) => (
            <button
              key={v}
              onClick={() => setVistaStore(v)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${vista === v ? 'bg-coral-soft text-[#0E7490]' : 'text-muted hover:text-ink'}`}
            >
              <Icono size={15} strokeWidth={1.75} aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setImpExp((o) => !o)}
          aria-expanded={impExp}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
        >
          <Upload size={14} strokeWidth={1.75} aria-hidden />
          Importar / Exportar
          <ChevronDown size={14} strokeWidth={2} aria-hidden className={`transition-transform ${impExp ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Acordeón Import/Export (colapsado por defecto; toda su lógica intacta) */}
      {impExp && (
        <div className="rounded-2xl border border-line bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-paper-2 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-paper">
              📎 Elegir archivo (Excel/CSV)
              <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onArchivo} className="hidden" />
            </label>
            {archivo && <span className="max-w-[180px] truncate text-xs text-muted" title={archivo.name}>{archivo.name}</span>}
            <label className="text-xs font-semibold text-muted">Modo:</label>
            <Select
              ariaLabel="Modo de importación"
              value={modo}
              onChange={(v) => { const m = v as 'actualizar' | 'reemplazar'; setModo(m); if (archivo) preview(archivo, m) }}
              options={[{ value: 'actualizar', label: 'Actualizar (por código)' }, { value: 'reemplazar', label: 'Reemplazar todo' }]}
            />
          </div>
          {resumen && (
            <p className="mt-2 text-xs text-muted">Formato {String(resumen.formato)} · {String(resumen.validas)} válidas · {String(resumen.aActualizar)} a actualizar · {String(resumen.aAgregar)} nuevas · {String(resumen.invalidas)} inválidas · {String(resumen.sinDescripcion)} sin descripción · {String(resumen.sinGenero)} sin género</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={importar} disabled={!archivo || trabajando} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper disabled:opacity-50">{trabajando ? '…' : 'Importar'}</button>
            <button onClick={mejorarIA} disabled={trabajando} className="rounded-full bg-paper-2 px-4 py-2 text-sm font-bold text-ink disabled:opacity-50">Mejorar con IA</button>
            <a href={conBase('/api/catalogo/export?formato=xlsx')} className="text-xs text-coral underline">Descargar plantilla (Excel)</a>
            <a href={conBase('/api/catalogo/export?formato=csv')} className="text-xs text-coral underline">CSV</a>
            <a href={conBase('/api/pedidos/export')} className="text-xs text-coral underline">Descargar pedidos</a>
          </div>
          {resultado && <p className="mt-2 text-xs font-semibold text-sage">{resultado}</p>}
        </div>
      )}

      {/* Catálogo */}
      {cargando ? (
        <p className="py-8 text-sm text-muted">buscando…</p>
      ) : productos.length === 0 ? (
        <p className="py-8 text-sm text-muted">sin resultados</p>
      ) : vista === 'lista' ? (
        // ── LISTA (tabla) ───────────────────────────────────────────────────
        <div className="rounded-2xl border border-line bg-card">
          <table className="w-full table-fixed text-sm">
            <colgroup><col className="w-[48%]" /><col className="w-[16%]" /><col className="w-[11%]" /><col className="w-[12%]" /><col className="w-[13%]" /></colgroup>
            <thead>
              <tr className="text-left text-xs font-semibold text-muted">
                <th className="px-4 py-2.5">Libro</th>
                <th className="px-3 py-2.5">Categoría</th>
                <th className="px-3 py-2.5 text-right">Precio</th>
                <th className="px-3 py-2.5">Stock</th>
                <th className="px-4 py-2.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p, i) => {
                const b = badgeStock(p.stock)
                const agotado = p.stock <= 0
                const cc = cat(p)
                const tc = cc ? tinteCat(cc) : null
                return (
                  <tr key={i} className="border-t-[0.5px] border-[#f0f0f3] transition-colors hover:bg-[#f9fafb]">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Portada cat={cat(p)} className="h-9 w-9 flex-shrink-0 rounded-md" />
                        <div className="min-w-0">
                          <p className="truncate font-medium capitalize text-ink" title={p.nombre}>{tituloLegible(p.nombre)}</p>
                          <p className="truncate text-xs text-muted">{[p.marca, p.presentacion].filter(Boolean).join(' · ') || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {cc && tc ? (
                        <span className="inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: tc[0], color: tc[1] }}>{cc}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-display font-semibold text-ink">S/ {Number(p.precio).toFixed(2)}</td>
                    <td className="px-3 py-2.5"><span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.cls}`}>{b.label}</span></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end">
                        {agotado ? (
                          <button onClick={reponer} className="inline-flex items-center rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-muted transition hover:text-ink">Reponer</button>
                        ) : (
                          <button
                            onClick={() => compartir(p)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-[13px] font-semibold text-white outline-none transition-colors duration-150 hover:bg-[#0E7490] focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-1"
                          >
                            <FaWhatsapp size={15} aria-hidden /> Compartir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        // ── GRID (cards) ────────────────────────────────────────────────────
        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visibles.map((p, i) => {
            const b = badgeStock(p.stock)
            const agotado = p.stock <= 0
            const categoria = cat(p)
            const tc = categoria ? tinteCat(categoria) : null
            return (
              <div
                key={i}
                style={{ animationDelay: `${Math.min(i * 25, 250)}ms` }}
                className="anim-subir flex h-full flex-col rounded-xl bg-card p-4 shadow-[0_1px_3px_rgba(16,24,40,0.07),0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-150 hover:shadow-[0_4px_12px_rgba(16,24,40,0.10),0_2px_4px_rgba(16,24,40,0.06)]"
              >
                <p className="min-h-[2.5rem] text-[13px] font-semibold capitalize leading-snug text-ink line-clamp-2" title={p.nombre}>{tituloLegible(p.nombre)}</p>
                {(p.marca || categoria) && (
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                    {tc && <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full" style={{ background: tc[1] }} aria-hidden />}
                    <span className="truncate">{[p.marca, categoria].filter(Boolean).join(' · ')}</span>
                  </p>
                )}
                <div className="mt-auto">
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="font-display text-base font-semibold text-ink">S/ {Number(p.precio).toFixed(2)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${b.cls}`}>{b.label}</span>
                  </div>
                  <div className="mt-2 flex justify-end">
                    {agotado ? (
                      <button onClick={reponer} className="inline-flex min-h-[32px] items-center rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold text-muted transition hover:text-ink">Reponer</button>
                    ) : (
                      <button onClick={() => compartir(p)} className={`${BTN_COMPARTIR} min-h-[32px] px-3 py-1.5 text-[13px] font-semibold`}>
                        <FaWhatsapp size={15} aria-hidden /> Compartir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Paginación (client-side; respeta búsqueda y toggle activos) */}
      {!cargando && productos.length > 0 && totalPaginas > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
          <button
            disabled={pag === 1}
            onClick={() => setPagina(pag - 1)}
            className="inline-flex h-9 items-center gap-1 rounded-lg border-[0.5px] border-[#f0f0f3] px-3 text-[13px] font-semibold text-ink transition hover:bg-[#f5f5fa] disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft size={15} strokeWidth={2} aria-hidden /> Anterior
          </button>
          {rangoPaginas(pag, totalPaginas).map((n, idx) =>
            typeof n === 'string' ? (
              <span key={`e${idx}`} className="grid h-9 w-9 place-items-center text-[13px] text-muted">…</span>
            ) : (
              <button
                key={n}
                onClick={() => setPagina(n)}
                aria-current={n === pag ? 'page' : undefined}
                className={`grid h-9 w-9 place-items-center rounded-lg text-[13px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-1 ${n === pag ? 'bg-coral text-white' : 'text-ink hover:bg-[#f5f5fa]'}`}
              >
                {n}
              </button>
            ),
          )}
          <button
            disabled={pag === totalPaginas}
            onClick={() => setPagina(pag + 1)}
            className="inline-flex h-9 items-center gap-1 rounded-lg border-[0.5px] border-[#f0f0f3] px-3 text-[13px] font-semibold text-ink transition hover:bg-[#f5f5fa] disabled:pointer-events-none disabled:opacity-40"
          >
            Siguiente <ChevronRight size={15} strokeWidth={2} aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
