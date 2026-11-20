'use client'
import { useState } from 'react'
import { Palette, X } from 'lucide-react'
import { PRESETS, CORE_LABELS, derivar, aplicarVars, type CoreVars, type Preset } from './temas-data'
import { useEscapeKey } from '@/lib/ui/useEscapeKey'
import { ItemBoton } from './sidebar-ui'

const LIGHT = PRESETS[0].core

function leerCustom(): { core: CoreVars; nombre: string } {
  try {
    const raw = localStorage.getItem('tema-custom')
    if (raw) return JSON.parse(raw)
  } catch {}
  return { core: { ...LIGHT }, nombre: 'Mi tema' }
}

// Aplica un set de vars y persiste (para el preload anti-flash del layout).
function persistir(id: string, core: CoreVars) {
  const vars = derivar(core)
  aplicarVars(vars)
  try {
    localStorage.setItem('tema-id', id)
    localStorage.setItem('tema-vars', JSON.stringify(vars))
  } catch {}
}

export function Temas({ colapsado }: { colapsado: boolean }) {
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState('light')
  const [custom, setCustom] = useState<CoreVars>({ ...LIGHT })
  const [nombre, setNombre] = useState('Mi tema')
  useEscapeKey(open, () => setOpen(false))

  function abrir() {
    // Cargar estado guardado al abrir (event handler → sin setState-en-effect).
    try {
      setActiveId(localStorage.getItem('tema-id') || 'light')
    } catch {}
    const c = leerCustom()
    setCustom(c.core)
    setNombre(c.nombre)
    setOpen(true)
  }

  function aplicarPreset(p: Preset) {
    setActiveId(p.id)
    persistir(p.id, p.core)
  }

  function aplicarCustom() {
    setActiveId('custom')
    persistir('custom', custom)
  }

  function guardarCustom() {
    try {
      localStorage.setItem('tema-custom', JSON.stringify({ core: custom, nombre }))
    } catch {}
    aplicarCustom()
  }

  return (
    <>
      <ItemBoton icono={Palette} label="Temas" colapsado={colapsado} onClick={abrir} />

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Temas"
            className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Temas</h2>
              <button onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-muted hover:bg-paper-2 hover:text-ink">
                <X size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </div>

            {/* Presets */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Sugeridos</p>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => aplicarPreset(p)}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-left transition ${
                    activeId === p.id ? 'border-coral ring-1 ring-coral' : 'border-line hover:border-muted'
                  }`}
                >
                  <span className="flex h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg border border-line">
                    <span className="h-full w-1/3" style={{ background: p.core.paper }} />
                    <span className="h-full w-1/3" style={{ background: p.core.coral }} />
                    <span className="h-full w-1/3" style={{ background: p.core.sage }} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{p.nombre}</span>
                    <span className="text-[11px] text-muted">{p.oscuro ? 'oscuro' : 'claro'}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* Custom */}
            <div className="mt-5 rounded-xl border border-line p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Personalizado</p>
                {activeId === 'custom' && <span className="text-[11px] text-coral">activo</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CORE_LABELS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="color"
                      value={custom[key]}
                      onChange={(e) => setCustom((c) => ({ ...c, [key]: e.target.value }))}
                      className="h-7 w-7 flex-shrink-0 cursor-pointer rounded border border-line bg-transparent"
                    />
                    <span className="truncate text-muted">{label}</span>
                  </label>
                ))}
              </div>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del tema"
                className="mt-3 w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-coral"
              />
              <div className="mt-2 flex gap-2">
                <button onClick={aplicarCustom} className="flex-1 rounded-lg border border-line py-1.5 text-sm font-semibold hover:bg-paper-2">
                  Aplicar
                </button>
                <button onClick={guardarCustom} className="flex-1 rounded-lg bg-ink py-1.5 text-sm font-semibold text-paper hover:opacity-90">
                  Guardar
                </button>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-muted">El tema se guarda en este navegador y se aplica al instante.</p>
          </div>
        </div>
      )}
    </>
  )
}
