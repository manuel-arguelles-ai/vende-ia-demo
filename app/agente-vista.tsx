'use client'
import { useEffect, useState } from 'react'
import { Bot, Sparkles, Target, MessageSquare, SlidersHorizontal, Eye, ShieldCheck } from 'lucide-react'
import { conBase } from '@/lib/base'
import type { AgentePerfil } from '@/lib/core/perfil'
import { Seccion, SaveBar, Toggle, ColumnasConfig } from './config-ui'
import { Select } from './select'

const TONOS = [['cercano', 'Cercano'], ['neutral', 'Neutral'], ['formal', 'Formal']] as const
const LARGOS = [['cortas', 'Cortas'], ['medias', 'Medias']] as const
const CIERRES = [
  ['informativo', 'Informativo — responde y deja decidir'],
  ['equilibrado', 'Equilibrado — propone el siguiente paso'],
  ['cerrador', 'Cerrador — empuja el cierre'],
] as const
const AGRES = [
  ['suave', 'Suave — sin urgencia'],
  ['media', 'Media — urgencia real y blanda'],
  ['alta', 'Alta — escasez real explícita'],
] as const

function muestra(p: AgentePerfil): string {
  const nombre = p.nombreBot || 'tu agente'
  const neg = p.negocioNombre || 'tu negocio'
  const emoji = p.emojis ? ' 🌱' : ''
  const saludo =
    p.saludoInicial || `Hola! Soy ${nombre} de ${neg}. ¿Qué estás buscando?${emoji}`
  const cierre =
    p.intensidadCierre === 'cerrador'
      ? 'Te lo aparto y te paso el Yape, ¿dale?'
      : p.intensidadCierre === 'equilibrado'
        ? '¿Te armo el pedido?'
        : 'Cualquier duda quedo atento.'
  return `${saludo}\n…\n${cierre}`
}

const INPUT_CLS =
  'mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20'
const LABEL_CLS = 'text-[11px] font-bold uppercase tracking-wider text-muted'

function L({ children }: { children: React.ReactNode }) {
  return <label className={LABEL_CLS}>{children}</label>
}

export function AgenteVista() {
  const [p, setP] = useState<AgentePerfil | null>(null)
  const [base, setBase] = useState<AgentePerfil | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    fetch(conBase('/api/agente'))
      .then((r) => r.json())
      .then((data: AgentePerfil) => { setP(data); setBase(data) })
      .catch(() => setP(null))
  }, [])

  if (!p) return <div className="p-6 text-muted">Cargando…</div>

  const dirty = !!base && JSON.stringify(p) !== JSON.stringify(base)
  const set = (campo: keyof AgentePerfil, v: unknown) => setP({ ...p, [campo]: v })

  async function guardar() {
    setGuardando(true)
    try {
      await fetch(conBase('/api/agente'), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(p),
      })
      setBase(p) // dirty vuelve a false
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="w-full max-w-[1600px] pb-4">
      <ColumnasConfig
        izquierda={<>
      <Seccion tone="cyan" icono={Bot} titulo="Identidad" sub="Quién es tu agente y qué vende.">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <L>Nombre del agente</L>
              <input className={INPUT_CLS} value={p.nombreBot ?? ''} onChange={(e) => set('nombreBot', e.target.value)} />
            </div>
            <div>
              <L>Nombre del negocio</L>
              <input className={INPUT_CLS} value={p.negocioNombre ?? ''} onChange={(e) => set('negocioNombre', e.target.value)} />
            </div>
          </div>
          <div>
            <L>Rubro (1-2 frases)</L>
            <textarea className={INPUT_CLS} value={p.rubro ?? ''} onChange={(e) => set('rubro', e.target.value)} />
          </div>
          <div>
            <L>Categorías que vende</L>
            <textarea className={INPUT_CLS} value={p.categorias ?? ''} onChange={(e) => set('categorias', e.target.value)} />
          </div>
        </div>
      </Seccion>

      <Seccion tone="purple" icono={Sparkles} titulo="Voz y estilo" sub="Cómo habla el agente con tus clientes.">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <L>Tono</L>
            <Select className="mt-1 w-full" ariaLabel="Tono" value={p.tono} onChange={(v) => set('tono', v)} options={TONOS.map(([v, t]) => ({ value: v, label: t }))} />
          </div>
          <div>
            <L>Largo</L>
            <Select className="mt-1 w-full" ariaLabel="Largo" value={p.longitud} onChange={(v) => set('longitud', v)} options={LARGOS.map(([v, t]) => ({ value: v, label: t }))} />
          </div>
          <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-start sm:justify-end">
            <L>Usar emojis</L>
            <div className="sm:mt-1"><Toggle checked={p.emojis} onChange={(v) => set('emojis', v)} ariaLabel="Usar emojis" /></div>
          </div>
        </div>
      </Seccion>

      </>}
        derecha={<>
      <Seccion tone="amber" icono={Target} titulo="Comportamiento de venta" sub="Cuánto empuja el agente hacia el cierre.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <L>Intensidad de cierre</L>
            <Select className="mt-1 w-full" ariaLabel="Intensidad de cierre" value={p.intensidadCierre} onChange={(v) => set('intensidadCierre', v)} options={CIERRES.map(([v, t]) => ({ value: v, label: t }))} />
          </div>
          <div>
            <L>Agresividad</L>
            <Select className="mt-1 w-full" ariaLabel="Agresividad" value={p.agresividad} onChange={(v) => set('agresividad', v)} options={AGRES.map(([v, t]) => ({ value: v, label: t }))} />
          </div>
        </div>
        {/* Aviso de seguridad destacado (no se puede desactivar) */}
        <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-[#f5f5fa] p-3">
          <ShieldCheck size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 flex-shrink-0 text-[#0E7490]" />
          <p className="text-[12.5px] leading-snug text-ink">
            Tu agente solo responde con tu catálogo real — <span className="font-semibold">nunca inventa precios ni stock</span>.
            <span className="text-muted"> No se puede desactivar.</span>
          </p>
        </div>
      </Seccion>

      <Seccion tone="blue" icono={MessageSquare} titulo="Mensajes" sub="Textos base que usa el agente.">
        <div className="space-y-3">
          <div>
            <L>Saludo inicial</L>
            <textarea className={INPUT_CLS} value={p.saludoInicial ?? ''} onChange={(e) => set('saludoInicial', e.target.value)} />
          </div>
          <div>
            <L>Cuando no sabe algo</L>
            <textarea className={INPUT_CLS} value={p.mensajeNoSe ?? ''} onChange={(e) => set('mensajeNoSe', e.target.value)} />
          </div>
          <div>
            <L>Temas prohibidos</L>
            <textarea className={INPUT_CLS} value={p.temasProhibidos ?? ''} onChange={(e) => set('temasProhibidos', e.target.value)} />
          </div>
        </div>
      </Seccion>
        </>}
        wide={<>
      <Seccion tone="green" icono={SlidersHorizontal} titulo="Avanzado" sub="Instrucciones extra (opcional).">
        <div>
          <L>Instrucciones para tu agente</L>
          <textarea className={INPUT_CLS} rows={4} value={p.instruccionesExtra ?? ''} onChange={(e) => set('instruccionesExtra', e.target.value)} />
        </div>
      </Seccion>

      <Seccion tone="cyan" icono={Eye} titulo="Vista previa" sub={`Así suena ${p.nombreBot || 'tu agente'}.`}>
        {/* Burbuja de chat entrante estilo WhatsApp (mensaje real del agente) */}
        <div className="rounded-xl bg-[#f9fafb] p-4">
          <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-line bg-white px-3 py-2 text-[13.5px] leading-snug text-ink shadow-[0_1px_2px_rgba(33,31,26,0.05)]">
            {muestra(p)}
          </div>
        </div>
      </Seccion>
        </>}
      />

      <SaveBar dirty={dirty} guardando={guardando} onGuardar={guardar} onDescartar={() => base && setP(base)} />
    </div>
  )
}
