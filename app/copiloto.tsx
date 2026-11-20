'use client'
import { useEffect, useState } from 'react'
import type { Conversacion } from '@/lib/core/conversaciones'
import type { DatosNegocio } from '@/lib/core/negocio'
import { conBase } from '@/lib/base'
import { Sugerencias } from './sugerencias'
import { useToast } from './toast'
import { useConfirm } from './confirm'
import { mutar } from '@/lib/ui/fetchJson'
import { Tag } from 'lucide-react'
import { categoriaEtiqueta, CLASES_CATEGORIA } from '@/lib/ui/lead'
import { Select } from './select'

// Copiloto contextual del lead seleccionado (columna derecha del pipeline):
// resumen IA, sugerencias, cierre de venta, ficha (etiquetas/notas/follow-up)
// e insertadores (snippets de pago + catálogo) hacia el composer del chat.

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3 shadow-[0_1px_2px_rgba(33,31,26,0.04)]">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{titulo}</p>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function ResumenCard({ remitente }: { remitente: string }) {
  const [resumen, setResumen] = useState<{ puntos: string[]; siguientePaso: string } | null>(null)
  const [cargando, setCargando] = useState(false)

  async function generar() {
    setCargando(true)
    try {
      const res = await fetch(conBase('/api/resumen'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ remitente }),
      })
      if (res.ok) setResumen(await res.json())
    } finally {
      setCargando(false)
    }
  }

  return (
    <Card titulo="Resumen IA">
      {!resumen ? (
        <button
          onClick={generar}
          disabled={cargando}
          className="rounded-full bg-paper-2 px-3 py-1 text-xs font-bold text-ink hover:bg-line disabled:opacity-50"
        >
          {cargando ? 'leyendo…' : '✦ Generar resumen'}
        </button>
      ) : (
        <ul className="space-y-1 text-[12.5px] leading-snug">
          {resumen.puntos.map((p, i) => (
            <li key={i}>• {p}</li>
          ))}
          <li className="pt-1 font-bold text-coral">→ {resumen.siguientePaso}</li>
        </ul>
      )}
    </Card>
  )
}

type TiendaOpc = { id: number; nombre: string }

function CierreCard({ c, refetch }: { c: Conversacion; refetch: () => void }) {
  const [cerrando, setCerrando] = useState(false)
  const [monto, setMonto] = useState('')
  const [tiendaId, setTiendaId] = useState('')
  const [tiendas, setTiendas] = useState<TiendaOpc[]>([])
  const toast = useToast()

  useEffect(() => {
    fetch(conBase('/api/tiendas')).then((r) => (r.ok ? r.json() : [])).then(setTiendas).catch(() => {})
  }, [])

  async function cerrar(
    estado: 'ganado' | 'perdido' | 'reabierto' | 'reservada',
    tipo?: 'venta' | 'reserva',
  ) {
    const r = await mutar(conBase('/api/cierres'), {
      method: 'POST',
      body: JSON.stringify({
        remitente: c.remitente, estado,
        monto: (estado === 'ganado' || estado === 'reservada') && monto ? Number(monto) : undefined,
        tipo,
        tiendaId: tiendaId ? Number(tiendaId) : undefined,
      }),
    })
    if (!r.ok) return toast.error(r.error)
    toast.ok(estado === 'reservada' ? 'Reserva registrada 📌' : estado === 'ganado' ? '¡Venta cerrada! 🏆' : estado === 'perdido' ? 'Marcado como perdido' : 'Reabierto')
    setCerrando(false); setMonto(''); setTiendaId('')
    refetch()
  }

  return (
    <Card titulo="Ciclo de venta">
      {c.cierre ? (
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${c.cierre.estado === 'ganado' ? 'bg-sage-soft text-sage' : c.cierre.estado === 'reservada' ? 'bg-[var(--tibio-soft,#fef3c7)] text-[var(--tibio,#b45309)]' : 'bg-paper-2 text-muted'}`}>
            {c.cierre.estado === 'ganado' ? `🏆 Venta${c.cierre.monto ? ` · S/${c.cierre.monto}` : ''}` : c.cierre.estado === 'reservada' ? `📌 Reserva${c.cierre.monto ? ` · S/${c.cierre.monto}` : ''}` : '✗ Perdido'}
          </span>
          <button onClick={() => cerrar('reabierto')} className="text-xs font-bold text-muted hover:text-ink">↺ reabrir</button>
        </div>
      ) : cerrando ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input autoFocus className="w-24 rounded-full border border-line bg-white px-2.5 py-1 text-xs outline-none focus:border-coral" placeholder="monto S/" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
            {tiendas.length > 0 && (
              <Select
                ariaLabel="Tienda"
                value={tiendaId}
                onChange={setTiendaId}
                options={[{ value: '', label: '— tienda —' }, ...tiendas.map((t) => ({ value: String(t.id), label: t.nombre }))]}
              />
            )}
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => cerrar('ganado', 'venta')} className="rounded-full bg-sage px-2.5 py-1 text-xs font-bold text-white">🏆 Venta</button>
            <button onClick={() => cerrar('reservada', 'reserva')} className="rounded-full bg-[var(--tibio,#b45309)] px-2.5 py-1 text-xs font-bold text-white">📌 Reserva</button>
            <button onClick={() => setCerrando(false)} className="text-xs text-muted">cancelar</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <button onClick={() => setCerrando(true)} className="rounded-full bg-sage-soft px-3 py-1 text-xs font-bold text-sage hover:brightness-95">Cerrar venta/reserva</button>
          <button onClick={() => cerrar('perdido')} className="rounded-full bg-paper-2 px-3 py-1 text-xs font-bold text-muted hover:text-ink">✗ Perdido</button>
        </div>
      )}
    </Card>
  )
}

function FichaCard({ c, refetch }: { c: Conversacion; refetch: () => void }) {
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('')
  const [notas, setNotas] = useState<{ id: number; texto: string }[]>([])
  const [nuevaNota, setNuevaNota] = useState('')
  // Edición manual de la ficha (la IA la crea/enriquece sola; lo manual pisa).
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(c.nombre ?? '')
  const [ciudad, setCiudad] = useState(c.zona ?? '')
  const toast = useToast()
  const confirm = useConfirm()

  async function guardarFicha() {
    const r = await mutar(conBase('/api/contactos'), {
      method: 'PATCH',
      body: JSON.stringify({ remitente: c.remitente, nombre: nombre.trim() || null, ciudad: ciudad.trim() || null }),
    })
    if (!r.ok) return toast.error(r.error)
    toast.ok('Ficha guardada')
    setEditando(false)
    refetch()
  }

  async function eliminarFicha() {
    const ok = await confirm({
      titulo: 'Eliminar ficha',
      mensaje: 'Se borra la ficha del contacto. La conversación NO se elimina.',
      confirmar: 'Eliminar',
      peligro: true,
    })
    if (!ok) return
    const r = await mutar(conBase('/api/contactos'), {
      method: 'DELETE',
      body: JSON.stringify({ remitente: c.remitente }),
    })
    if (!r.ok) return toast.error(r.error)
    toast.ok('Ficha eliminada')
    setEditando(false)
    refetch()
  }

  useEffect(() => {
    fetch(conBase(`/api/notas?remitente=${encodeURIComponent(c.remitente)}`))
      .then((r) => (r.ok ? r.json() : []))
      .then(setNotas)
      .catch(() => {})
  }, [c.remitente])

  async function etiqueta(e: string, accion: 'agregar' | 'quitar') {
    const r = await mutar(conBase('/api/etiquetas'), {
      method: 'POST',
      body: JSON.stringify({ remitente: c.remitente, etiqueta: e, accion }),
    })
    if (!r.ok) return toast.error(r.error)
    setNuevaEtiqueta('')
    refetch()
  }

  async function agregarNota() {
    if (!nuevaNota.trim()) return
    const r = await mutar(conBase('/api/notas'), {
      method: 'POST',
      body: JSON.stringify({ remitente: c.remitente, texto: nuevaNota }),
    })
    if (!r.ok) return toast.error(r.error)
    toast.ok('Nota agregada')
    setNuevaNota('')
    const rl = await fetch(conBase(`/api/notas?remitente=${encodeURIComponent(c.remitente)}`))
    if (rl.ok) setNotas(await rl.json())
  }

  async function recordar(horas: number) {
    // eslint-disable-next-line react-hooks/purity -- solo se invoca desde onClick, no en render
    const cuando = new Date(Date.now() + horas * 3600_000).toISOString()
    const r = await mutar(conBase('/api/recordatorios'), {
      method: 'POST',
      body: JSON.stringify({ remitente: c.remitente, cuando, nota: 'follow-up' }),
    })
    if (!r.ok) return toast.error(r.error)
    toast.ok('Recordatorio creado')
    refetch()
  }

  return (
    <Card titulo="Ficha del contacto">
      {editando ? (
        <div className="space-y-1.5">
          <input
            className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs outline-none focus:border-coral"
            placeholder="nombre…"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs outline-none focus:border-coral"
            placeholder="ciudad / zona…"
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button onClick={guardarFicha} className="rounded-full bg-sage px-3 py-1 text-[11px] font-bold text-white">✓ Guardar</button>
            <button onClick={() => setEditando(false)} className="text-[11px] font-bold text-muted">cancelar</button>
            <button onClick={eliminarFicha} className="ml-auto text-[11px] font-bold text-coral hover:underline">🗑 eliminar</button>
          </div>
        </div>
      ) : (
        <div className="space-y-1 text-[12.5px]">
          {c.nombre && <p><span className="text-muted">Nombre:</span> {c.nombre}</p>}
          {c.producto && <p><span className="text-muted">Interés:</span> 🛒 {c.producto}</p>}
          {c.zona && <p><span className="text-muted">Zona:</span> 📍 {c.zona}</p>}
          <p><span className="text-muted">Mensajes:</span> {c.turnos.length}</p>
          <button
            onClick={() => {
              setNombre(c.nombre ?? '')
              setCiudad(c.zona ?? '')
              setEditando(true)
            }}
            className="mt-1 rounded-full bg-paper-2 px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-line"
          >
            ✎ {c.nombre ? 'Editar ficha' : 'Crear ficha'}
          </button>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1">
        {c.etiquetas.map((e) => (
          <span
            key={e.etiqueta}
            title={e.origen === 'auto' ? 'detectada por la IA' : 'manual'}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${CLASES_CATEGORIA[categoriaEtiqueta(e.etiqueta)]}`}
          >
            <Tag size={11} strokeWidth={2} aria-hidden /> {e.etiqueta}
            <button onClick={() => etiqueta(e.etiqueta, 'quitar')} className="opacity-50 hover:opacity-100">✕</button>
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <input
          className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2.5 py-1 text-xs outline-none focus:border-coral"
          placeholder="nueva etiqueta…"
          value={nuevaEtiqueta}
          onChange={(e) => setNuevaEtiqueta(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && nuevaEtiqueta.trim() && etiqueta(nuevaEtiqueta, 'agregar')}
        />
        <button onClick={() => nuevaEtiqueta.trim() && etiqueta(nuevaEtiqueta, 'agregar')} className="rounded-lg bg-ink px-2.5 text-xs font-bold text-paper">+</button>
      </div>

      <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-muted">Follow-up</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {([['en 3 h', 3], ['mañana', 18], ['en 3 días', 72]] as [string, number][]).map(([label, h]) => (
          <button key={label} onClick={() => recordar(h)} className="rounded-full bg-paper-2 px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-line">
            ⏰ {label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-muted">Notas internas</p>
      <div className="mt-1 max-h-28 space-y-1 overflow-y-auto">
        {notas.map((n) => (
          <div key={n.id} className="rounded-lg bg-paper-2/70 px-2.5 py-1.5 text-xs leading-snug">{n.texto}</div>
        ))}
        {notas.length === 0 && <p className="text-xs text-muted">sin notas</p>}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <input
          className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2.5 py-1 text-xs outline-none focus:border-coral"
          placeholder="nota interna…"
          value={nuevaNota}
          onChange={(e) => setNuevaNota(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregarNota()}
        />
        <button onClick={agregarNota} className="rounded-lg bg-ink px-2.5 text-xs font-bold text-paper">+</button>
      </div>
    </Card>
  )
}

function InsertarCard({ negocio, onInsertar }: { negocio: DatosNegocio; onInsertar: (t: string) => void }) {
  const [q, setQ] = useState('')
  const [productos, setProductos] = useState<{ nombre: string; precio: number | string }[]>([])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) return setProductos([])
      const res = await fetch(conBase(`/api/catalogo?q=${encodeURIComponent(q)}`))
      if (res.ok) setProductos(((await res.json()) as { nombre: string; precio: number | string }[]).slice(0, 5))
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  const snippets: [string, string][] = []
  if (negocio.yape) snippets.push(['Yape', `Puedes yapear al ${negocio.yape}${negocio.titular ? ` (a nombre de ${negocio.titular})` : ''}`])
  if (negocio.plin) snippets.push(['Plin', `Puedes plinear al ${negocio.plin}${negocio.titular ? ` (a nombre de ${negocio.titular})` : ''}`])
  if (negocio.cuenta) snippets.push(['Cuenta', `Transferencia: ${negocio.banco ?? ''} ${negocio.cuenta}${negocio.cci ? ` · CCI ${negocio.cci}` : ''}`.trim()])
  if (negocio.horario) snippets.push(['Horario', `Atendemos: ${negocio.horario}`])

  return (
    <Card titulo="Insertar al mensaje">
      {snippets.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {snippets.map(([label, texto]) => (
            <button key={label} onClick={() => onInsertar(texto)} className="rounded-full bg-paper-2 px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-line">
              💳 {label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">Carga tus datos de pago en «Mi negocio» para tener snippets acá.</p>
      )}
      <input
        className="mt-2 w-full rounded-full border border-line bg-white px-3 py-1.5 text-xs outline-none focus:border-coral"
        placeholder="🔍 producto del catálogo…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {productos.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {productos.map((p, i) => (
            <button
              key={i}
              onClick={() => {
                onInsertar(`${p.nombre} — S/${Number(p.precio).toFixed(2)}`)
                setQ('')
              }}
              className="block w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-left text-xs leading-tight hover:border-coral"
            >
              {p.nombre.slice(0, 50)} · <span className="font-bold">S/{Number(p.precio).toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

export function Copiloto({
  c,
  negocio,
  refetch,
  onInsertar,
}: {
  c: Conversacion
  negocio: DatosNegocio
  refetch: () => void
  onInsertar: (t: string) => void
}) {
  return (
    <div className="w-full space-y-3 xl:w-[300px] xl:flex-shrink-0">
      <ResumenCard key={`r-${c.remitente}`} remitente={c.remitente} />
      <div className="rounded-2xl border border-line bg-card p-3 shadow-[0_1px_2px_rgba(33,31,26,0.04)]">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Sugerencias IA</p>
        <Sugerencias key={`s-${c.remitente}`} remitente={c.remitente} onElegir={onInsertar} plano />
      </div>
      <CierreCard c={c} refetch={refetch} />
      <FichaCard key={`f-${c.remitente}`} c={c} refetch={refetch} />
      <InsertarCard negocio={negocio} onInsertar={onInsertar} />
    </div>
  )
}
