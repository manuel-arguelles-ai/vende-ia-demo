'use client'
import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  SquareKanban,
  Contact,
  Package,
  Store,
  Bot,
  BookOpen,
  PlayCircle,
  Bell,
  CreditCard,
  Users,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  type LucideIcon,
} from 'lucide-react'
import { conBase } from '@/lib/base'
import { WaSync } from './wa-sync'
import { Temas } from './temas'
import { ItemBoton } from './sidebar-ui'
import { useTenantInfo } from './use-tenant-info'
import { inicialesLead } from '@/lib/ui/lead'
import { permisoDe, type Seccion } from '@/lib/core/permisos'

// Title Case (para el eyebrow del tenant, que viene en MAYÚSCULAS).
function titleCase(s: string): string {
  return s.toLocaleLowerCase('es').replace(/\p{L}+/gu, (w) => w[0].toLocaleUpperCase('es') + w.slice(1))
}

// Secciones cuya visibilidad el admin puede configurar para el asesor.
const SECCIONES_CONFIG = new Set<Vista>(['pipeline', 'contactos', 'pedidos', 'catalogo'])

// Sidebar de navegación de la app (colapsable a franja de íconos en desktop,
// drawer con overlay en mobile).
export type Vista = 'pipeline' | 'contactos' | 'pedidos' | 'negocio' | 'agente' | 'catalogo' | 'autorizados' | 'alertas' | 'plan' | 'equipo'

const ITEMS: { key: Vista; icono: LucideIcon; label: string }[] = [
  { key: 'pipeline', icono: SquareKanban, label: 'Pipeline' },
  { key: 'contactos', icono: Contact, label: 'Contactos' },
  { key: 'pedidos', icono: Package, label: 'Pedidos' },
  { key: 'negocio', icono: Store, label: 'Mi negocio' },
  { key: 'agente', icono: Bot, label: 'Mi Agente' },
  { key: 'catalogo', icono: BookOpen, label: 'Catálogo' },
  { key: 'autorizados', icono: PlayCircle, label: 'Modo demo' },
  { key: 'alertas', icono: Bell, label: 'Alertas' },
  { key: 'plan', icono: CreditCard, label: 'Plan' },
  { key: 'equipo', icono: Users, label: 'Equipo' },
]

const SOLO_ADMIN = new Set<Vista>(['negocio', 'agente', 'autorizados', 'alertas', 'plan', 'equipo'])

// Estado de colapsado persistido en localStorage, expuesto vía store externo
// (useSyncExternalStore) para ser SSR-safe sin setState dentro de un effect.
const COLAPSADO_KEY = 'sidebar-colapsado'
const colapsadoListeners = new Set<() => void>()
function subColapsado(cb: () => void) {
  colapsadoListeners.add(cb)
  return () => { colapsadoListeners.delete(cb) }
}
function getColapsado() {
  try { return localStorage.getItem(COLAPSADO_KEY) === '1' } catch { return false }
}
function setColapsado(v: boolean) {
  try { localStorage.setItem(COLAPSADO_KEY, v ? '1' : '0') } catch {}
  colapsadoListeners.forEach((l) => l())
}

// Isotipo de marca (turquesa) — visible siempre; en el rail queda como ancla.
function Isotipo() {
  return (
    <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-coral font-display text-lg font-bold text-white shadow-sm">
      v
    </span>
  )
}

// Avatar del usuario a partir de las iniciales de su nombre (o email).
function Avatar({ nombre }: { nombre: string }) {
  const ini = inicialesLead(nombre) || nombre.trim()[0]?.toUpperCase() || '?'
  return (
    <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-coral-soft text-sm font-bold text-[#0E7490]">
      {ini}
    </span>
  )
}

export function Sidebar({
  vista,
  setVista,
  movilAbierto,
  setMovilAbierto,
}: {
  vista: Vista
  setVista: (v: Vista) => void
  movilAbierto: boolean
  setMovilAbierto: (a: boolean) => void
}) {
  const info = useTenantInfo()
  const nombreTenant = info?.nombre ?? null
  const usuarioNombre = info?.usuarioNombre?.trim() || ''
  const rol = info?.rol
  const colapsado = useSyncExternalStore(subColapsado, getColapsado, () => false)

  // Badge de alertas de fraude pendientes (solo admin).
  const [alertasPend, setAlertasPend] = useState(0)
  useEffect(() => {
    if (rol !== 'admin') return
    fetch(conBase('/api/alertas'))
      .then((r) => (r.ok ? r.json() : []))
      .then((a: { resuelta: boolean }[]) => setAlertasPend(a.filter((x) => !x.resuelta).length))
      .catch(() => {})
  }, [rol, vista])

  const items = ITEMS.filter((it) => {
    // Secciones solo-admin: ocultas al asesor.
    if (SOLO_ADMIN.has(it.key) && rol !== 'admin') return false
    // Secciones configurables: el admin puede marcarlas 'oculto' para el asesor.
    if (rol !== 'admin' && SECCIONES_CONFIG.has(it.key) && permisoDe(info?.permisos ?? undefined, it.key as Seccion) === 'oculto') return false
    return true
  })

  // Navegar y, en mobile, cerrar el drawer.
  const irA = (v: Vista) => {
    setVista(v)
    setMovilAbierto(false)
  }

  async function salir() {
    await fetch(conBase('/api/logout'), { method: 'POST' })
    window.location.href = conBase('/login')
  }

  return (
    <>
      {/* Overlay (solo mobile, con el drawer abierto) */}
      {movilAbierto && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMovilAbierto(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-[248px] flex-col border-r border-line bg-card transition-[transform,width] duration-200 ease-out lg:sticky lg:top-0 lg:z-30 lg:translate-x-0 lg:flex-shrink-0 ${
          movilAbierto ? 'translate-x-0' : '-translate-x-full'
        } ${colapsado ? 'lg:w-[72px]' : 'lg:w-[248px]'}`}
      >
        {/* Header: isotipo + marca (en rail queda solo el isotipo) */}
        <div className={`flex h-16 items-center gap-2.5 border-b border-line px-3 ${colapsado ? 'lg:justify-center lg:px-0' : ''}`}>
          <Isotipo />
          <div className={`min-w-0 flex-1 ${colapsado ? 'lg:hidden' : ''}`}>
            <p className="truncate text-[12px] font-semibold tracking-[0.03em] text-[#6B6B85]">
              {titleCase(nombreTenant ?? 'vende-ia')}
            </p>
            <p className="font-display text-lg font-semibold leading-tight">vende-ia</p>
          </div>
          {/* Cerrar drawer (solo mobile) */}
          <button
            onClick={() => setMovilAbierto(false)}
            aria-label="Cerrar menú"
            className="rounded-lg p-1.5 text-muted outline-none transition hover:bg-paper hover:text-ink focus-visible:ring-2 focus-visible:ring-coral lg:hidden"
          >
            <X size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        {/* Toggle colapsar/expandir (solo desktop) */}
        <div className="hidden px-2 pt-2 lg:block">
          <ItemBoton
            icono={colapsado ? PanelLeftOpen : PanelLeftClose}
            label={colapsado ? 'Expandir' : 'Colapsar'}
            colapsado={colapsado}
            onClick={() => setColapsado(!colapsado)}
          />
        </div>

        {/* Navegación principal */}
        <nav aria-label="Menú principal" className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-2">
          {items.map((it) => (
            <ItemBoton
              key={it.key}
              icono={it.icono}
              label={it.label}
              colapsado={colapsado}
              activa={vista === it.key}
              onClick={() => irA(it.key)}
              badge={it.key === 'alertas' ? alertasPend : undefined}
            />
          ))}
        </nav>

        {/* Divider sutil */}
        <div className="mx-3 h-px bg-[#f0f0f3]" />

        {/* Navegación secundaria */}
        <div className="space-y-1 p-2">
          {rol === 'admin' && <WaSync colapsado={colapsado} onUpgrade={() => irA('plan')} />}
          <Temas colapsado={colapsado} />
          <ItemBoton icono={LogOut} label="Salir" colapsado={colapsado} onClick={salir} />
        </div>

        {/* Perfil al pie */}
        {info?.email && (
          <div className={`flex items-center gap-2.5 border-t border-line px-3 py-3 ${colapsado ? 'lg:justify-center lg:px-0' : ''}`}>
            <Avatar nombre={usuarioNombre || info.email} />
            <div className={`min-w-0 flex-1 ${colapsado ? 'lg:hidden' : ''}`}>
              {usuarioNombre ? (
                <>
                  <p className="truncate text-[13px] font-semibold text-[#1C1D21]">{usuarioNombre}</p>
                  <p className="truncate text-[12px] text-[#8181A5]" title={info.email}>{info.email}</p>
                </>
              ) : (
                <p className="truncate text-[13px] text-[#1C1D21]" title={info.email}>{info.email}</p>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
