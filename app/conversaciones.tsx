'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Inbox, User, Tag } from 'lucide-react'
import type { Conversacion } from '@/lib/core/conversaciones'
import type { DatosNegocio } from '@/lib/core/negocio'
import { filtrarConversaciones, type Filtros } from '@/lib/core/filtros'
import { haceCuanto, estancado } from './useDatos'
import { conBase } from '@/lib/base'
import { FiltrosBar } from './filtros'
import { Copiloto } from './copiloto'
import { useTenantInfo } from './use-tenant-info'
import { useToast } from './toast'
import { mutar } from '@/lib/ui/fetchJson'
import { ordenarLeadsAsesor } from '@/lib/ui/prioridad'
import { telefonoLead, partirNombre, inicialesLead, categoriaEtiqueta } from '@/lib/ui/lead'
import { Select } from './select'

// Hora (HH:MM) y día (separador) de un mensaje, en zona horaria de Perú.
function horaDe(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' }) } catch { return '' }
}
function diaDe(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'America/Lima' }) } catch { return '' }
}

// Etapa del pipeline. Las tres primeras las asigna el score de Nina; las dos
// últimas son estados de gestión: derivado (esperando contacto del asesor) y
// humano (takeover: el asesor conversa y Nina está pausada).
type Columna = 'frio' | 'tibio' | 'caliente' | 'derivado' | 'humano'

// `dot` es un color literal (se pinta con style); `barra`/`tinte` siguen siendo
// clases. `vacio`/`vacioSub` son el microcopy del estado vacío por columna.
const COLUMNAS: { key: Columna; titulo: string; dot: string; tinte: string; barra: string; vacio: string; vacioSub: string }[] = [
  { key: 'frio', titulo: 'Frío', dot: '#378ADD', tinte: 'bg-[var(--frio-soft)] text-[var(--frio)]', barra: 'bg-[var(--frio)]', vacio: 'Sin leads fríos', vacioSub: 'Aparecerán aquí al calificarse.' },
  { key: 'tibio', titulo: 'Tibio', dot: '#F4BE5E', tinte: 'bg-[var(--tibio-soft)] text-[var(--tibio)]', barra: 'bg-[var(--tibio)]', vacio: 'Sin leads tibios', vacioSub: 'Aparecerán aquí al calificarse.' },
  { key: 'caliente', titulo: 'Caliente', dot: '#E24B4A', tinte: 'bg-[var(--caliente-soft)] text-[var(--caliente)]', barra: 'bg-[var(--caliente)]', vacio: 'Sin leads calientes', vacioSub: 'Aparecerán aquí al calificarse.' },
  { key: 'derivado', titulo: 'Derivados', dot: '#0891B2', tinte: 'bg-coral-soft text-coral', barra: 'bg-coral', vacio: 'Sin derivados', vacioSub: 'Aparecerán al derivar un lead.' },
  { key: 'humano', titulo: 'Atención humana', dot: '#1D9E75', tinte: 'bg-sage-soft text-sage', barra: 'bg-sage', vacio: 'Sin leads en atención', vacioSub: 'Aparecerán al tomar una conversación.' },
]

// Avatar circular con iniciales del nombre real (ignora el código de escenario).
function AvatarLead({ nombre }: { nombre?: string | null }) {
  const ini = inicialesLead(partirNombre(nombre).nombre)
  return (
    <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-coral-soft text-xs font-bold text-[#0E7490]">
      {ini || <User size={16} strokeWidth={1.75} aria-hidden />}
    </span>
  )
}

// A qué columna pertenece un lead (la gestión pisa a la temperatura).
function columnaDe(c: Conversacion): Columna {
  if (c.enAtencion) return 'humano'
  if (c.derivado) return 'derivado'
  return c.temperatura ?? 'frio'
}

function Chip({ children, tono = 'gris', title }: { children: React.ReactNode; tono?: 'gris' | 'sage' | 'coral' | 'frio' | 'caliente' | 'tibio' | 'estado' | 'pago' | 'entrega' | 'producto'; title?: string }) {
  const cls = {
    gris: 'bg-paper-2 text-muted',
    sage: 'bg-sage-soft text-sage',
    coral: 'bg-coral-soft text-coral',
    frio: 'bg-[var(--frio-soft)] text-[var(--frio)]',
    caliente: 'bg-caliente-soft text-caliente',
    tibio: 'bg-tibio-soft text-tibio',
    estado: 'bg-[#FAEEDA] text-[#854F0B]',
    pago: 'bg-[#E1F5EE] text-[#0F6E56]',
    entrega: 'bg-[#EEEDFE] text-[#3C3489]',
    producto: 'border-[0.5px] border-[#ececf2] bg-[#f5f5fa] text-muted',
  }[tono]
  return (
    <span title={title} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  )
}

function Tarjeta({ c, activa, onClick, barra, idx, bot, nuevo = false }: { c: Conversacion; activa: boolean; onClick: () => void; barra: string; idx: number; bot: string; nuevo?: boolean }) {
  const ultimo = c.turnos[c.turnos.length - 1]
  const frio = estancado(c) && !c.enAtencion
  const { codigo, nombre: nombreReal } = partirNombre(c.nombre)
  // Quién escribió el último mensaje: el entrante del lead va sin prefijo (lo
  // habitual); marcamos solo cuando respondimos nosotros (asesor) o el bot.
  const prefijo = ultimo?.rol === 'asesor' ? '👤 ' : ultimo?.rol === 'bot' ? '🌱 ' : ''
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${Math.min(idx * 45, 360)}ms` }}
      className={`anim-subir w-full rounded-xl border-[0.5px] bg-card p-3 text-left shadow-[0_1px_2px_rgba(33,31,26,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(33,31,26,0.08)] ${
        activa ? 'border-ink ring-1 ring-ink' : nuevo ? 'border-coral/50' : 'border-[#f0f0f3]'
      } ${frio ? 'anim-brasa' : ''}`}
    >
      <div className="flex items-start gap-2.5">
        <AvatarLead nombre={c.nombre} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              {nuevo && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-coral" title="sin abrir" aria-label="sin abrir" />}
              <span className="min-w-0 truncate tracking-tight">
                {codigo && <span className="text-[11px] font-normal text-muted">{codigo} · </span>}
                {nombreReal
                  ? <><span className="font-medium text-ink">{nombreReal}</span><span className="font-normal text-muted"> · {telefonoLead(c.numero)}</span></>
                  : <span className="font-medium text-ink">{telefonoLead(c.numero)}</span>}
              </span>
            </span>
            <span className="flex-shrink-0 text-[11px] font-medium text-muted">{haceCuanto(c.ultimoAt)}</span>
          </div>
          {ultimo && (
            <p className="mt-0.5 truncate text-[13px] text-muted">
              {prefijo}
              {ultimo.texto}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {c.cierre && (
          <Chip tono={c.cierre.estado === 'ganado' ? 'sage' : 'gris'}>
            {c.cierre.estado === 'ganado' ? `🏆 ganado${c.cierre.monto ? ` S/${c.cierre.monto}` : ''}` : '✗ perdido'}
          </Chip>
        )}
        {/* eslint-disable-next-line react-hooks/purity -- frescura por render intencional (badge de follow-up vencido) */}
        {c.recordatorio && new Date(c.recordatorio).getTime() <= Date.now() && <Chip tono="caliente">⏰ seguimiento</Chip>}
        {frio && !c.cierre && <Chip tono="estado">⏳ enfriándose</Chip>}
        {c.producto && <Chip tono="producto">🛒 {c.producto}</Chip>}
        {c.etiquetas.slice(0, 2).map((e) => (
          <Chip key={e.etiqueta} tono={categoriaEtiqueta(e.etiqueta)} title={e.origen === 'auto' ? `detectada por ${bot}` : 'manual'}>
            <span className="inline-flex items-center gap-1"><Tag size={11} strokeWidth={2} aria-hidden />{e.etiqueta}</span>
          </Chip>
        ))}
        {c.etiquetas.length > 2 && <Chip>+{c.etiquetas.length - 2}</Chip>}
        {c.zona && <Chip>📍 {c.zona}</Chip>}
      </div>
      {c.score != null && (
        <div className="mt-2.5 flex items-center gap-2" title="Probabilidad de cierre estimada por IA">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-paper-2">
            <div className={`h-full rounded-full ${barra}`} style={{ width: `${c.score}%` }} />
          </div>
          <span className="flex-shrink-0 rounded-full bg-coral-soft px-1.5 py-0.5 text-[10px] font-semibold text-[#0E7490]">Score IA {c.score}</span>
        </div>
      )}
    </button>
  )
}

// Plantillas "/" del composer: builtin desde los datos del negocio + las propias.
function plantillasDe(n: DatosNegocio): { atajo: string; texto: string }[] {
  const p: { atajo: string; texto: string }[] = []
  if (n.yape) p.push({ atajo: 'yape', texto: `Puedes yapear al ${n.yape}${n.titular ? ` (a nombre de ${n.titular})` : ''}. Me avisas con la captura y coordinamos el envío 🙌` })
  if (n.plin) p.push({ atajo: 'plin', texto: `Puedes plinear al ${n.plin}${n.titular ? ` (a nombre de ${n.titular})` : ''}. Me avisas con la captura 🙌` })
  if (n.cuenta) p.push({ atajo: 'cuenta', texto: `Datos para transferencia: ${n.banco ?? ''} ${n.cuenta}${n.cci ? ` · CCI ${n.cci}` : ''}${n.titular ? ` · Titular: ${n.titular}` : ''}`.trim() })
  if (n.delivery) p.push({ atajo: 'delivery', texto: n.delivery })
  if (n.horario) p.push({ atajo: 'horario', texto: `Nuestro horario de atención: ${n.horario}` })
  p.push({ atajo: 'gracias', texto: '¡Gracias por tu compra! 🌱 Cualquier cosa me escribes por aquí.' })
  for (const [atajo, texto] of Object.entries(n.plantillas ?? {})) p.push({ atajo, texto })
  return p
}

type AsesorOpc = { id: number; nombre: string | null; email: string }

// Panel de chat limpio: mensajes + barra de takeover + composer con plantillas "/".
// (Resumen, sugerencias, cierre y ficha viven en el Copiloto, a la derecha.)
function Chat({
  c,
  onClose,
  refetch,
  draft,
  setDraft,
  negocio,
  bot,
  rol,
  asesores,
}: {
  c: Conversacion
  onClose: () => void
  refetch: () => void
  draft: string
  setDraft: (t: string) => void
  negocio: DatosNegocio
  bot: string
  rol?: string
  asesores: AsesorOpc[]
}) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [asignSel, setAsignSel] = useState('')
  const toast = useToast()
  const col = COLUMNAS.find((x) => x.key === columnaDe(c))
  const esWhatsapp = c.remitente.includes('@')
  const { codigo, nombre: nombreReal } = partirNombre(c.nombre)
  const fondoRef = useRef<HTMLDivElement>(null)

  // El chat siempre arranca (y se mantiene) en el último mensaje.
  useEffect(() => {
    fondoRef.current?.scrollIntoView({ block: 'end' })
  }, [c.remitente, c.turnos.length])

  // Menú de plantillas cuando el borrador empieza con "/"
  const plantillas = useMemo(() => plantillasDe(negocio), [negocio])
  const enPlantilla = draft.startsWith('/')
  const sugerenciasPlantilla = enPlantilla
    ? plantillas.filter((p) => p.atajo.startsWith(draft.slice(1).toLowerCase())).slice(0, 5)
    : []

  async function responder() {
    if (!draft.trim() || enviando) return
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch(conBase('/api/responder'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ remitente: c.remitente, texto: draft }),
      })
      if (res.ok) {
        setDraft('')
        refetch()
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'no se pudo enviar')
      }
    } catch {
      setError('no se pudo enviar')
    } finally {
      setEnviando(false)
    }
  }

  async function togglePausa() {
    const tomando = !c.enAtencion
    const r = await mutar(conBase('/api/pausar'), {
      method: 'POST',
      body: JSON.stringify({ remitente: c.remitente, pausado: tomando }),
    })
    if (r.ok) {
      toast.ok(tomando ? 'Tomaste la conversación' : `Devuelta a ${bot}`)
      refetch()
    } else {
      toast.error(r.error)
    }
  }

  async function asignar(usuarioId: string) {
    const r = await mutar(conBase('/api/conversaciones/asignar'), {
      method: 'POST',
      body: JSON.stringify({ remitente: c.remitente, usuarioId: usuarioId ? Number(usuarioId) : null }),
    })
    if (r.ok) {
      toast.ok(usuarioId ? 'Lead asignado' : 'Asignación quitada')
      refetch()
    } else {
      toast.error(r.error)
    }
  }

  return (
    <div className="flex h-[76vh] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_2px_12px_rgba(33,31,26,0.06)] xl:h-full">
      <div className="flex items-start justify-between gap-2 border-b border-line bg-paper-2/60 p-3.5">
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight">
            {codigo && <span className="text-sm font-normal text-muted">{codigo} · </span>}
            <span className="font-semibold text-ink">{nombreReal || telefonoLead(c.numero)}</span>
            {nombreReal && <span className="text-sm font-normal text-muted"> · {telefonoLead(c.numero)}</span>}
            {esWhatsapp && (
              <a
                href={`https://wa.me/${c.numero}`}
                target="_blank"
                rel="noreferrer"
                className="ml-2 align-middle text-xs font-bold text-sage underline-offset-2 hover:underline"
              >
                WhatsApp ↗
              </a>
            )}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {col && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${col.tinte}`}>
                {col.titulo}
                {c.score != null ? ` · ${c.score}` : ''}
              </span>
            )}
            {c.producto && <Chip tono="sage">🛒 {c.producto}</Chip>}
            {c.zona && <Chip>📍 {c.zona}</Chip>}
          </div>
          {rol === 'admin' && asesores.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted">Asignar a:</span>
              <Select
                ariaLabel="Asignar a"
                value={asignSel}
                onChange={(v) => { setAsignSel(v); asignar(v) }}
                options={[{ value: '', label: 'Sin asignar' }, ...asesores.map((a) => ({ value: String(a.id), label: a.nombre ?? a.email }))]}
              />
            </div>
          )}
        </div>
        <button onClick={onClose} className="rounded-full px-2 py-0.5 text-muted transition hover:bg-paper-2">
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3.5">
        {c.turnos.map((t, i) => {
          const dia = diaDe(t.created_at)
          const muestraDia = i === 0 || dia !== diaDe(c.turnos[i - 1].created_at)
          return (
            <div key={i}>
              {muestraDia && (
                <div className="my-2 flex justify-center">
                  <span className="rounded-full bg-paper-2 px-2.5 py-0.5 text-[10.5px] font-semibold text-muted">{dia}</span>
                </div>
              )}
              <div className={`flex flex-col ${t.rol === 'cliente' ? 'items-start' : 'items-end'}`}>
                <span
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13.5px] leading-snug ${
                    t.rol === 'cliente'
                      ? 'rounded-bl-md border border-line bg-white text-ink'
                      : t.rol === 'asesor'
                        ? 'rounded-br-md bg-coral text-white'
                        : 'rounded-br-md bg-sage text-white'
                  }`}
                >
                  {t.imagen_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a href={conBase(t.imagen_url)} target="_blank" rel="noreferrer">
                      <img
                        src={conBase(t.imagen_url)}
                        alt="adjunto"
                        className="mb-1 max-h-56 w-auto rounded-lg border border-line"
                      />
                    </a>
                  )}
                  {t.texto}
                </span>
                <span className="mt-0.5 px-1 text-[10px] text-muted">{horaDe(t.created_at)}</span>
              </div>
            </div>
          )
        })}
        <div ref={fondoRef} />
      </div>

      {/* Barra de takeover: estado de Nina + toggle */}
      <div className="flex items-center justify-between gap-2 border-t border-line bg-paper-2/60 px-3.5 py-2">
        <span className="text-xs font-semibold text-muted">
          {c.enAtencion ? `👤 Estás atendiendo vos — ${bot} en pausa` : `🌱 ${bot} atiende esta conversación`}
        </span>
        <button
          onClick={togglePausa}
          className={`rounded-full px-3 py-1 text-xs font-bold transition ${
            c.enAtencion ? 'bg-sage text-white hover:brightness-95' : 'bg-paper-2 text-ink hover:bg-line'
          }`}
        >
          {c.enAtencion ? `Devolver a ${bot}` : 'Tomar conversación'}
        </button>
      </div>

      {/* Composer del asesor (al responder, Nina se pausa sola) */}
      <div className="relative border-t border-line p-2.5">
        {error && <p className="mb-1.5 px-1 text-xs font-semibold text-coral">{error}</p>}
        {sugerenciasPlantilla.length > 0 && (
          <div className="absolute bottom-full left-2.5 right-2.5 z-10 mb-1 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
            {sugerenciasPlantilla.map((p) => (
              <button
                key={p.atajo}
                onClick={() => setDraft(p.texto)}
                className="block w-full px-3 py-2 text-left text-xs hover:bg-paper-2"
              >
                <span className="font-bold text-coral">/{p.atajo}</span>{' '}
                <span className="text-muted">{p.texto.slice(0, 60)}…</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-full border border-line bg-white px-3.5 py-2 text-sm outline-none transition placeholder:text-muted focus:border-coral focus:ring-2 focus:ring-coral/20"
            placeholder={esWhatsapp ? 'Responder por WhatsApp…  («/» para plantillas)' : 'Responder (simulador)…  («/» para plantillas)'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !enPlantilla && responder()}
          />
          <button
            onClick={responder}
            disabled={enviando || !draft.trim() || enPlantilla}
            className="rounded-full bg-coral px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-50"
          >
            {enviando ? '…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Conversaciones({
  convs,
  refetch,
  negocio,
  onChatAbierto,
  esNuevo,
  marcarVisto,
  lista,
  abrirRemitente,
  onAbrirConsumido,
}: {
  convs: Conversacion[]
  refetch: () => void
  negocio: DatosNegocio
  onChatAbierto?: (abierto: boolean) => void
  esNuevo?: (rem: string) => boolean
  marcarVisto?: (rem: string) => void
  lista?: boolean
  abrirRemitente?: string | null
  onAbrirConsumido?: () => void
}) {
  const tenantInfo = useTenantInfo()
  const bot = tenantInfo?.nombreBot ?? 'tu asistente'
  const rol = tenantInfo?.rol
  const [asesores, setAsesores] = useState<AsesorOpc[]>([])
  const [sel, setSel] = useState<string | null>(null)

  // Para admins, cargar la lista de asesores activos una vez.
  useEffect(() => {
    if (rol !== 'admin') return
    fetch(conBase('/api/usuarios'))
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: { id: number; nombre: string | null; email: string; rol: string; activo: boolean }[]) =>
        setAsesores(lista.filter((u) => u.rol === 'asesor' && u.activo))
      )
      .catch(() => {})
  }, [rol])

  // Avisa al shell para colapsar los KPIs cuando hay un chat abierto.
  useEffect(() => {
    onChatAbierto?.(sel !== null)
  }, [sel, onChatAbierto])

  // Apertura programática (ej. clic en una alerta → abrir esa conversación).
  // Ajuste de estado en render (patrón recomendado por React sobre setState en
  // un effect): si el padre pide abrir un remitente que ya está en la lista y
  // no es el seleccionado, lo seleccionamos aquí mismo.
  if (abrirRemitente && abrirRemitente !== sel && convs.some((c) => c.remitente === abrirRemitente)) {
    setSel(abrirRemitente)
  }
  // Ya seleccionado el pedido: avisamos al padre para que limpie la señal.
  useEffect(() => {
    if (abrirRemitente && abrirRemitente === sel) onAbrirConsumido?.()
  }, [abrirRemitente, sel, onAbrirConsumido])
  const [draft, setDraft] = useState('')
  const [filtros, setFiltros] = useState<Filtros>({})

  const visibles = useMemo(() => filtrarConversaciones(convs, filtros), [convs, filtros])
  const etiquetasDisponibles = useMemo(
    () => [...new Set(convs.flatMap((c) => c.etiquetas.map((e) => e.etiqueta)))].sort(),
    [convs],
  )
  const seleccionada = convs.find((c) => c.remitente === sel) ?? null

  // Lista priorizada (vista del asesor): una sola columna ordenada por urgencia.
  // eslint-disable-next-line react-hooks/purity -- prioridad por recordatorio vencido (ahora) es intencional
  const listaOrdenada = useMemo(() => (lista ? ordenarLeadsAsesor(visibles, Date.now()) : []), [lista, visibles])

  // Insertar snippet (copiloto): se agrega al borrador actual del composer.
  const insertar = (t: string) => setDraft(draft ? `${draft} ${t}` : t)

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-5">
      <FiltrosBar
        filtros={filtros}
        setFiltros={setFiltros}
        etiquetas={etiquetasDisponibles}
        total={convs.length}
        visibles={visibles.length}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
        {/* Las columnas mantienen un ancho legible: si chat + copiloto comprimen,
            el pipeline scrollea horizontal; cada columna scrollea vertical interno. */}
        {lista ? (
          <div className="min-h-0 flex-1 xl:overflow-y-auto">
            <div className={`mx-auto space-y-2 ${seleccionada ? '' : 'max-w-2xl'}`}>
              {listaOrdenada.map((c, i) => (
                <Tarjeta
                  key={c.remitente}
                  c={c}
                  idx={i}
                  barra={COLUMNAS.find((x) => x.key === columnaDe(c))?.barra ?? 'bg-coral'}
                  activa={c.remitente === sel}
                  bot={bot}
                  nuevo={esNuevo?.(c.remitente) ?? false}
                  onClick={() => {
                    if (c.remitente !== sel) setDraft('')
                    setSel(c.remitente)
                    marcarVisto?.(c.remitente)
                  }}
                />
              ))}
              {listaOrdenada.length === 0 && (
                <p className="px-2 py-10 text-center text-sm text-muted">No tienes leads asignados todavía.</p>
              )}
            </div>
          </div>
        ) : (
        <div className="min-h-0 flex-1 overflow-x-auto pb-1 xl:overflow-y-hidden">
          <div className={`grid grid-cols-1 gap-3 sm:grid-cols-3 xl:h-full xl:grid-cols-5 ${seleccionada ? 'xl:min-w-[760px]' : 'xl:min-w-[900px]'}`}>
            {COLUMNAS.map((col) => {
              const items = visibles.filter((c) => columnaDe(c) === col.key)
              return (
                <div key={col.key} className="flex flex-col rounded-xl border-[0.5px] border-[#f0f0f3] bg-[#f9fafb] p-2 xl:min-h-0">
                  <div className="mb-2 flex items-center justify-between px-2 py-1.5">
                    <span className="flex items-center gap-2 text-[13px] font-bold">
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: col.dot }} />
                      {col.titulo}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        items.length > 0 ? 'bg-coral-soft text-[#0E7490]' : 'border-[0.5px] border-[#ececf2] bg-card text-muted'
                      }`}
                    >
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                    {items.map((c, i) => (
                      <Tarjeta
                        key={c.remitente}
                        c={c}
                        idx={i}
                        barra={col.barra}
                        activa={c.remitente === sel}
                        bot={bot}
                        nuevo={esNuevo?.(c.remitente) ?? false}
                        onClick={() => {
                          if (c.remitente !== sel) setDraft('')
                          setSel(c.remitente)
                          marcarVisto?.(c.remitente)
                        }}
                      />
                    ))}
                    {items.length === 0 && (
                      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2.5 px-4 text-center">
                        <Inbox size={44} strokeWidth={1.5} aria-hidden style={{ color: col.dot, opacity: 0.35 }} />
                        <p className="text-[15px] font-medium text-[#6B7280]">{col.vacio}</p>
                        <p className="text-[13px] text-[#8181A5]">{col.vacioSub}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        )}

        {seleccionada && (
          <>
            <div className="xl:h-full xl:w-[400px] xl:flex-shrink-0">
              <div className="xl:h-full">
                <Chat
                  key={seleccionada.remitente}
                  c={seleccionada}
                  onClose={() => setSel(null)}
                  refetch={refetch}
                  draft={draft}
                  setDraft={setDraft}
                  negocio={negocio}
                  bot={bot}
                  rol={rol}
                  asesores={asesores}
                />
              </div>
            </div>
            <div className="xl:h-full xl:overflow-y-auto">
              <Copiloto c={seleccionada} negocio={negocio} refetch={refetch} onInsertar={insertar} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
