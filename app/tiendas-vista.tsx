'use client'
import { useEffect, useState, useCallback } from 'react'
import { conBase } from '@/lib/base'

type Tienda = {
  id: number; nombre: string; direccion: string | null; distrito: string | null; horario: string | null; activa: boolean
}

const VACIA = { nombre: '', direccion: '', distrito: '', horario: '' }

// Subsección de "Mi negocio": tiendas físicas (puntos de recojo para venta/reserva).
export function TiendasGestor() {
  const [tiendas, setTiendas] = useState<Tienda[]>([])
  const [form, setForm] = useState(VACIA)
  const [editId, setEditId] = useState<number | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const r = await fetch(conBase('/api/tiendas'))
    if (r.ok) setTiendas(await r.json())
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function guardar() {
    if (!form.nombre.trim()) { setError('Escribe el nombre de la tienda'); return }
    setError(null)
    setTrabajando(true)
    const body = editId ? { id: editId, ...form } : form
    await fetch(conBase('/api/tiendas'), {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setForm(VACIA); setEditId(null); setTrabajando(false); cargar()
  }

  async function toggleActiva(t: Tienda) {
    await fetch(conBase('/api/tiendas'), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, activa: !t.activa }),
    })
    cargar()
  }

  function editar(t: Tienda) {
    setEditId(t.id)
    setForm({ nombre: t.nombre, direccion: t.direccion ?? '', distrito: t.distrito ?? '', horario: t.horario ?? '' })
  }

  return (
    <div>
      <div className="space-y-2">
        {tiendas.map((t) => (
          <div key={t.id} className={`flex flex-wrap items-center gap-2 rounded-xl border border-line p-2.5 ${t.activa ? '' : 'opacity-50'}`}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.nombre} {!t.activa && <span className="text-[10px] font-bold text-muted">(inactiva)</span>}</p>
              <p className="text-xs text-muted">{[t.direccion, t.distrito, t.horario].filter(Boolean).join(' · ') || '—'}</p>
            </div>
            <button onClick={() => editar(t)} className="rounded-full bg-paper-2 px-3 py-1 text-xs font-semibold text-ink">Editar</button>
            <button onClick={() => toggleActiva(t)} className="rounded-full bg-paper-2 px-3 py-1 text-xs font-semibold text-muted">{t.activa ? 'Desactivar' : 'Activar'}</button>
          </div>
        ))}
        {tiendas.length === 0 && <p className="text-xs text-muted">Sin tiendas todavía.</p>}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input value={form.nombre} onChange={(e) => { setForm({ ...form, nombre: e.target.value }); if (error) setError(null) }} placeholder="Nombre (ej. Central)" className={`rounded-lg border px-3 py-2 text-sm ${error ? 'border-caliente' : 'border-line'}`} />
        <input value={form.distrito} onChange={(e) => setForm({ ...form, distrito: e.target.value })} placeholder="Distrito" className="rounded-lg border border-line px-3 py-2 text-sm" />
        <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Dirección" className="rounded-lg border border-line px-3 py-2 text-sm" />
        <input value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} placeholder="Horario (ej. Lun-Sáb 9-7)" className="rounded-lg border border-line px-3 py-2 text-sm" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button onClick={guardar} disabled={trabajando} className="rounded-full bg-coral px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-50">
          {editId ? 'Guardar cambios' : 'Agregar tienda'}
        </button>
        {editId && <button onClick={() => { setEditId(null); setForm(VACIA); setError(null) }} className="text-xs text-muted underline">cancelar</button>}
        {error && <span className="text-xs font-semibold text-caliente">{error}</span>}
      </div>
    </div>
  )
}
