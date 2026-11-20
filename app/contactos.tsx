'use client'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { List, LayoutGrid, Search, MoreHorizontal, Pencil, Trash2, ArrowUp, ArrowDown, Contact as ContactIcon, User, Check } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import type { Contacto } from '@/lib/core/contactos'
import type { Conversacion } from '@/lib/core/conversaciones'
import { conBase } from '@/lib/base'
import { jidANumero } from '@/lib/core/handoff'
import { telefonoLead, partirNombre, inicialesLead } from '@/lib/ui/lead'
import { haceCuanto } from './useDatos'
import { useTenantInfo } from './use-tenant-info'
import { useToast } from './toast'
import { useConfirm } from './confirm'
import { mutar } from '@/lib/ui/fetchJson'

// ── Estado (temperatura) reusando la MISMA escala del Pipeline ───────────────
type EstadoKey = 'frio' | 'tibio' | 'caliente' | 'derivado' | 'humano'
const ESTADO_BADGE: Record<EstadoKey, { label: string; dot: string; cls: string }> = {
  frio: { label: 'Frío', dot: '#185FA5', cls: 'bg-[#E6F1FB] text-[#185FA5]' },
  tibio: { label: 'Tibio', dot: '#854F0B', cls: 'bg-[#FAEEDA] text-[#854F0B]' },
  caliente: { label: 'Caliente', dot: '#C2474F', cls: 'bg-[#FFEAEC] text-[#C2474F]' },
  derivado: { label: 'Derivado', dot: '#0E7490', cls: 'bg-[#CFFAFE] text-[#0E7490]' },
  humano: { label: 'Atención humana', dot: '#0F6E56', cls: 'bg-[#E1F5EE] text-[#0F6E56]' },
}
// Misma prioridad que columnaDe() del Pipeline: gestión pisa a la temperatura.
function estadoDe(conv?: Conversacion): EstadoKey | null {
  if (!conv) return null
  if (conv.enAtencion) return 'humano'
  if (conv.derivado) return 'derivado'
  return conv.temperatura ?? 'frio'
}

// ── Preferencia Lista/Grid persistida (SSR-safe, sin setState en effect) ─────
type Vista = 'lista' | 'grid'
const VKEY = 'contactos-vista'
const vListeners = new Set<() => void>()
function subVista(cb: () => void) { vListeners.add(cb); return () => { vListeners.delete(cb) } }
function getVista(): Vista { try { return localStorage.getItem(VKEY) === 'grid' ? 'grid' : 'lista' } catch { return 'lista' } }
function setVistaStore(v: Vista) { try { localStorage.setItem(VKEY, v) } catch {}; vListeners.forEach((l) => l()) }

// Avatar circular con iniciales del nombre real (sin código de escenario).
function Avatar({ nombre }: { nombre: string | null }) {
  const ini = inicialesLead(partirNombre(nombre).nombre)
  return (
    <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-coral-soft text-xs font-bold text-[#0E7490]">
      {ini || <User size={16} strokeWidth={1.75} aria-hidden />}
    </span>
  )
}

function BadgeEstado({ estado }: { estado: EstadoKey | null }) {
  if (!estado) return <span className="text-muted">—</span>
  const b = ESTADO_BADGE[estado]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.cls}`}>
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: b.dot }} />
      {b.label}
    </span>
  )
}

type SortCol = 'nombre' | 'ultima'

export function Contactos({ convs }: { convs: Conversacion[] }) {
  const bot = useTenantInfo()?.nombreBot ?? 'tu asistente'
  const vista = useSyncExternalStore(subVista, getVista, () => 'lista' as Vista)
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ col: SortCol; dir: 'asc' | 'desc' }>({ col: 'ultima', dir: 'desc' })
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null)
  const toast = useToast()
  const confirm = useConfirm()

  const convPorRem = useMemo(() => new Map(convs.map((c) => [c.remitente, c])), [convs])

  async function cargar() {
    const r = await fetch(conBase('/api/contactos'))
    if (r.ok) setContactos(await r.json())
    setCargando(false)
  }

  useEffect(() => {
    const t = setTimeout(cargar, 0) // carga inicial diferida (lint de pureza)
    return () => clearTimeout(t)
  }, [])

  async function guardar(remitente: string) {
    const r = await mutar(conBase('/api/contactos'), {
      method: 'PATCH',
      body: JSON.stringify({ remitente, nombre: nombre.trim() || null, ciudad: ciudad.trim() || null }),
    })
    if (!r.ok) return toast.error(r.error)
    toast.ok('Contacto guardado')
    setEditando(null)
    cargar()
  }

  async function eliminar(remitente: string) {
    const ok = await confirm({
      titulo: 'Eliminar contacto',
      mensaje: 'Sus conversaciones NO se borran, solo la ficha.',
      confirmar: 'Eliminar',
      peligro: true,
    })
    if (!ok) return
    const r = await mutar(conBase('/api/contactos'), {
      method: 'DELETE',
      body: JSON.stringify({ remitente }),
    })
    if (!r.ok) return toast.error(r.error)
    toast.ok('Contacto eliminado')
    cargar()
  }

  function abrirEdicion(c: Contacto) {
    setEditando(c.remitente)
    setNombre(c.nombre ?? '')
    setCiudad(c.ciudad ?? '')
    setMenuAbierto(null)
  }

  // Datos derivados por contacto (memoizados sobre búsqueda/orden/convs).
  const filas = useMemo(() => {
    const t = q.trim().toLowerCase()
    const soloDigitos = t.replace(/\D/g, '')
    const enriquecidos = contactos.map((c) => {
      const num = jidANumero(c.telefono ?? c.remitente)
      const conv = convPorRem.get(c.remitente)
      return {
        c,
        num,
        tel: telefonoLead(num),
        real: partirNombre(c.nombre).nombre,
        estado: estadoDe(conv),
        ultimaIso: conv?.ultimoAt ?? c.actualizado ?? null,
        interes: c.productos.join(', '),
      }
    })
    const filtrados = !t
      ? enriquecidos
      : enriquecidos.filter((f) =>
          f.real.toLowerCase().includes(t) ||
          f.interes.toLowerCase().includes(t) ||
          (soloDigitos ? f.num.includes(soloDigitos) : false),
        )
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtrados].sort((a, b) => {
      if (sort.col === 'nombre') return dir * (a.real || '~').localeCompare(b.real || '~')
      const ta = a.ultimaIso ? new Date(a.ultimaIso).getTime() : 0
      const tb = b.ultimaIso ? new Date(b.ultimaIso).getTime() : 0
      return dir * (ta - tb)
    })
  }, [contactos, convPorRem, q, sort])

  function toggleSort(col: SortCol) {
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'nombre' ? 'asc' : 'desc' }))
  }

  if (cargando) return <p className="py-8 text-center text-sm text-muted">cargando contactos…</p>

  if (contactos.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-coral-soft text-[#0E7490]">
          <ContactIcon size={26} strokeWidth={1.5} aria-hidden />
        </span>
        <p className="mt-1 font-display text-lg font-semibold text-ink">Todavía no hay contactos</p>
        <p className="max-w-xs text-sm text-muted">{`Se crean solos cuando un cliente comparte su nombre, ciudad o intereses con ${bot}.`}</p>
      </div>
    )

  const flecha = sort.dir === 'asc' ? <ArrowUp size={13} strokeWidth={2} aria-hidden /> : <ArrowDown size={13} strokeWidth={2} aria-hidden />

  return (
    <div className="space-y-3">
      {/* Buscador + toggle Lista/Grid */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative min-w-0 flex-1 basis-64 max-w-[520px]">
          <Search size={16} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="w-full rounded-full border border-line bg-card py-1.5 pl-9 pr-3.5 text-sm outline-none transition placeholder:text-muted focus:border-coral"
            placeholder="Buscar por número, producto o nombre…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-full border border-line bg-card p-0.5">
          {([['lista', 'Lista', List], ['grid', 'Grid', LayoutGrid]] as [Vista, string, typeof List][]).map(([v, label, Icono]) => (
            <button
              key={v}
              onClick={() => setVistaStore(v)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                vista === v ? 'bg-coral-soft text-[#0E7490]' : 'text-muted hover:text-ink'
              }`}
            >
              <Icono size={15} strokeWidth={1.75} aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      {filas.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Sin resultados para «{q}».</p>
      ) : vista === 'lista' ? (
        // ── Vista LISTA (tabla densa) ───────────────────────────────────────
        <div className="rounded-2xl border border-line bg-card">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[34%]" /><col className="w-[24%]" /><col className="w-[16%]" /><col className="w-[12%]" /><col className="w-[14%]" />
            </colgroup>
            <thead>
              <tr className="text-left text-xs font-semibold text-muted">
                <th className="px-4 py-2.5">
                  <button onClick={() => toggleSort('nombre')} className="inline-flex items-center gap-1 hover:text-ink">
                    Contacto {sort.col === 'nombre' && flecha}
                  </button>
                </th>
                <th className="px-3 py-2.5">Interés</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5">
                  <button onClick={() => toggleSort('ultima')} className="inline-flex items-center gap-1 hover:text-ink">
                    Última act. {sort.col === 'ultima' && flecha}
                  </button>
                </th>
                <th className="px-4 py-2.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ c, num, tel, real, estado, ultimaIso, interes }) =>
                editando === c.remitente ? (
                  <tr key={c.remitente} className="border-t-[0.5px] border-[#f0f0f3] bg-[#f9fafb]">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input autoFocus className="w-48 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-coral" placeholder="nombre…" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                        <input className="w-40 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-coral" placeholder="ciudad…" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
                        <button onClick={() => guardar(c.remitente)} className="inline-flex items-center gap-1 rounded-full bg-sage px-3 py-1.5 text-xs font-bold text-white"><Check size={14} strokeWidth={2.5} /> Guardar</button>
                        <button onClick={() => setEditando(null)} className="text-xs font-bold text-muted">cancelar</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={c.remitente}
                    onClick={() => abrirEdicion(c)}
                    className="cursor-pointer border-t-[0.5px] border-[#f0f0f3] transition-colors hover:bg-[#f9fafb]"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar nombre={c.nombre} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{real || 'Sin nombre'}</p>
                          <p className="truncate text-xs text-muted">{tel}{c.ciudad ? ` · ${c.ciudad}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {interes ? <span className="block truncate">{interes}</span> : <span className="text-muted">Sin interés aún</span>}
                    </td>
                    <td className="px-3 py-2.5"><BadgeEstado estado={estado} /></td>
                    <td className="px-3 py-2.5 text-muted">{ultimaIso ? haceCuanto(ultimaIso) : '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {c.remitente.includes('@') && (
                          <a href={`https://wa.me/${num}`} target="_blank" rel="noreferrer" title="Abrir en WhatsApp" className="rounded-full p-1.5 text-sage transition hover:bg-sage-soft">
                            <FaWhatsapp size={16} aria-hidden />
                          </a>
                        )}
                        <div className="relative">
                          <button title="Acciones" onClick={() => setMenuAbierto((m) => (m === c.remitente ? null : c.remitente))} className="rounded-full p-1.5 text-muted transition hover:bg-paper-2 hover:text-ink">
                            <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />
                          </button>
                          {menuAbierto === c.remitente && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setMenuAbierto(null)} aria-hidden />
                              <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-line bg-card py-1 text-left shadow-lg">
                                <button onClick={() => abrirEdicion(c)} className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-ink hover:bg-paper-2"><Pencil size={14} strokeWidth={1.75} /> Editar ficha</button>
                                <button onClick={() => { setMenuAbierto(null); eliminar(c.remitente) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-[#C2474F] hover:bg-[#FFEAEC]"><Trash2 size={14} strokeWidth={1.75} /> Eliminar</button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        // ── Vista GRID (card actual, uniforme) ──────────────────────────────
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filas.map(({ c, num, tel, real }, i) => (
            <div
              key={c.remitente}
              style={{ animationDelay: `${Math.min(i * 35, 300)}ms` }}
              className="anim-subir rounded-2xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(33,31,26,0.04)]"
            >
              <div className="flex items-start justify-between gap-2">
                {editando === c.remitente ? (
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <input autoFocus className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-coral" placeholder="nombre…" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                    <input className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-coral" placeholder="ciudad…" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
                    <div className="flex gap-2">
                      <button onClick={() => guardar(c.remitente)} className="rounded-full bg-sage px-3 py-1 text-xs font-bold text-white">✓</button>
                      <button onClick={() => setEditando(null)} className="text-xs font-bold text-muted">cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar nombre={c.nombre} />
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-semibold leading-tight text-ink">{real || 'Sin nombre'}</p>
                      <p className="truncate text-sm text-muted">{tel}</p>
                    </div>
                  </div>
                )}
                <div className="flex flex-shrink-0 items-center gap-1">
                  {c.remitente.includes('@') && (
                    <a href={`https://wa.me/${num}`} target="_blank" rel="noreferrer" title="Abrir en WhatsApp" className="rounded-full p-1.5 text-sage transition hover:bg-sage-soft">
                      <FaWhatsapp size={16} aria-hidden />
                    </a>
                  )}
                  <button title="editar" onClick={() => abrirEdicion(c)} className="rounded-full p-1.5 text-muted transition hover:bg-paper-2 hover:text-ink">
                    <Pencil size={15} strokeWidth={1.75} aria-hidden />
                  </button>
                  <button title="eliminar" onClick={() => eliminar(c.remitente)} className="rounded-full p-1.5 text-muted transition hover:bg-[#FFEAEC] hover:text-[#C2474F]">
                    <Trash2 size={15} strokeWidth={1.75} aria-hidden />
                  </button>
                </div>
              </div>
              {editando !== c.remitente && (
                <>
                  <p className={`mt-2 text-sm ${c.ciudad ? '' : 'text-muted'}`}>📍 {c.ciudad || 'Sin distrito'}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.productos.length > 0 ? (
                      <>
                        {c.productos.slice(0, 4).map((p) => (
                          <span key={p} className="rounded-full bg-sage-soft px-2 py-0.5 text-[11px] font-semibold text-sage">🛒 {p}</span>
                        ))}
                        {c.productos.length > 4 && (
                          <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[11px] font-semibold text-muted">+{c.productos.length - 4}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] font-semibold text-muted">Sin intereses aún</span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
