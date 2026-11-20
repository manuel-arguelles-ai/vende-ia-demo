'use client'
import { useState } from 'react'
import { Store, Wallet, Bot, Building2, Eye, EyeOff } from 'lucide-react'
import type { DatosNegocio } from '@/lib/core/negocio'
import { conBase } from '@/lib/base'
import { useToast } from './toast'
import { Seccion, SaveBar, RadioGrupo, ColumnasConfig } from './config-ui'
import { Select } from './select'
import { TiendasGestor } from './tiendas-vista'

// Vista "Mi negocio": datos de pago/operativos que alimentan los snippets,
// las plantillas «/» del composer y las sugerencias IA. Reorganizada en
// secciones; sin cambiar campos ni la lógica del agente/tiendas.
type CampoDef = {
  clave: keyof DatosNegocio
  label: string
  ancho?: 'full'
  opciones?: { v: string; t: string }[]
  sensible?: boolean
  help?: string
}

const CAMPOS_NEGOCIO: CampoDef[] = [
  { clave: 'nombre', label: 'Nombre del negocio' },
  { clave: 'horario', label: 'Horario de atención', help: 'Si lo dejas vacío, el agente no informará horario de atención.' },
  { clave: 'delivery', label: 'Delivery / cobertura', help: 'Si lo dejas vacío, el agente no ofrecerá delivery ni cobertura.' },
  { clave: 'politicas', label: 'Políticas (cambios, garantía…)', help: 'Si lo dejas vacío, el agente no mencionará políticas de cambio o garantía.' },
]

const CAMPOS_COBRO: CampoDef[] = [
  { clave: 'yape', label: 'Yape' },
  { clave: 'titular_yape', label: 'Titular Yape' },
  { clave: 'plin', label: 'Plin' },
  { clave: 'titular_plin', label: 'Titular Plin' },
  { clave: 'banco', label: 'Banco' },
  { clave: 'tipo_cuenta', label: 'Tipo de cuenta', opciones: [{ v: '', t: '—' }, { v: 'corriente', t: 'Corriente' }, { v: 'ahorros', t: 'Ahorros' }] },
  { clave: 'cuenta', label: 'N° de cuenta', sensible: true },
  { clave: 'cci', label: 'CCI', sensible: true },
  { clave: 'titular_cuenta', label: 'Titular cuenta bancaria' },
  { clave: 'titular', label: 'Titular por defecto (fallback)', ancho: 'full' },
]

const INPUT = 'mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20'
const LABEL = 'text-[11px] font-bold uppercase tracking-wider text-muted'

// Campo sensible (N° de cuenta / CCI): enmascarado por defecto (•••• + últimos 4)
// con botón de ojo. Solo presentación; el valor real siempre vive en el estado.
function CampoSensible({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [ver, setVer] = useState(false)
  const [foco, setFoco] = useState(false)
  const display = ver || foco ? value : value ? `•••• ${value.slice(-4)}` : ''
  return (
    <div className="relative mt-1">
      <input
        className={`${INPUT} mt-0 pr-9`}
        value={display}
        inputMode="numeric"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVer((v) => !v)}
        aria-label={ver ? 'Ocultar' : 'Mostrar'}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted transition hover:text-ink"
      >
        {ver ? <EyeOff size={16} strokeWidth={1.75} aria-hidden /> : <Eye size={16} strokeWidth={1.75} aria-hidden />}
      </button>
    </div>
  )
}

// Campo genérico (nivel de módulo → tipo estable, no remonta el input al tipear).
function Campo({ def, value, onChange }: { def: CampoDef; value: string; onChange: (v: string | undefined) => void }) {
  return (
    <div className={def.ancho === 'full' ? 'sm:col-span-2' : ''}>
      <label className={LABEL}>{def.label}</label>
      {def.opciones ? (
        <div className="mt-1"><Select className="w-full" ariaLabel={def.label} value={value} onChange={(v) => onChange(v || undefined)} options={def.opciones.map((o) => ({ value: o.v, label: o.t }))} /></div>
      ) : def.sensible ? (
        <CampoSensible value={value} onChange={onChange} />
      ) : (
        <input className={INPUT} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {def.help && !value && <p className="mt-1 text-[11px] text-muted">{def.help}</p>}
    </div>
  )
}

export function NegocioVista({
  negocio,
  setNegocio,
}: {
  negocio: DatosNegocio
  setNegocio: (n: DatosNegocio) => void
}) {
  const toast = useToast()
  const [form, setForm] = useState<DatosNegocio>(negocio)
  const [base, setBase] = useState<DatosNegocio>(negocio)
  const [guardando, setGuardando] = useState(false)

  // Adoptar cambios externos del padre (carga inicial / guardado) sin pisar
  // ediciones en curso — ajuste de estado en render (evita setState en effect).
  if (negocio !== base) {
    setBase(negocio)
    setForm(negocio)
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(negocio)
  const set = (clave: keyof DatosNegocio, valor: string | undefined) => setForm((f) => ({ ...f, [clave]: valor }))

  async function guardar() {
    setGuardando(true)
    try {
      await fetch(conBase('/api/negocio'), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      setNegocio(form) // propaga al padre → se adopta → dirty vuelve a false
      toast.ok('Cambios guardados')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="w-full max-w-[1600px] pb-4">
      <p className="mb-4 text-sm text-muted">
        Estos datos alimentan los snippets del copiloto, las plantillas «/» del chat y las sugerencias IA
        (que solo usan datos reales: lo que no esté acá, no se inventa).
      </p>

      <ColumnasConfig
        izquierda={<>
      <Seccion tone="blue" icono={Store} titulo="Datos del negocio" sub="Identidad y operación que el agente puede compartir.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CAMPOS_NEGOCIO.map((def) => (
            <Campo key={def.clave} def={def} value={(form[def.clave] as string) ?? ''} onChange={(v) => set(def.clave, v)} />
          ))}
        </div>
      </Seccion>

      </>}
        derecha={<>
      <Seccion tone="green" icono={Wallet} titulo="Métodos de cobro" sub="Los únicos datos de pago que el agente puede dar (nunca inventa otros).">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CAMPOS_COBRO.map((def) => (
            <Campo key={def.clave} def={def} value={(form[def.clave] as string) ?? ''} onChange={(v) => set(def.clave, v)} />
          ))}
        </div>
      </Seccion>
        </>}
        wide={<>
      <Seccion tone="purple" icono={Bot} titulo="Comportamiento del agente" sub="Cómo cierra, deriva y hace seguimiento.">
        <div className="space-y-5">
          <RadioGrupo
            label="Modo del agente"
            value={form.modo_venta ?? 'cierre'}
            onChange={(v) => setForm((f) => ({ ...f, modo_venta: v }))}
            opciones={[
              { value: 'cierre', titulo: 'Cierra la venta', desc: 'Lleva el pedido hasta confirmarlo (producto + cantidad) y deriva al asesor solo para cobro y envío.' },
              { value: 'derivar', titulo: 'Solo deriva', desc: 'Atiende, recomienda e informa; pasa el lead a un asesor humano apenas se pone caliente (no cierra él).' },
            ]}
          />
          <RadioGrupo
            label="Cierre de ventas"
            value={form.cierre_auto ?? true}
            onChange={(v) => setForm((f) => ({ ...f, cierre_auto: v }))}
            opciones={[
              { value: true, titulo: 'Automático (agente)', desc: 'El agente registra la venta/reserva con la tienda en cuanto el cliente confirma forma de pago y tienda.' },
              { value: false, titulo: 'Manual (asesor)', desc: 'El agente ofrece las opciones; el asesor registra la venta/reserva desde el chat del CRM.' },
            ]}
          />
          <RadioGrupo
            label="Seguimiento proactivo"
            value={form.seguimiento_auto ?? false}
            onChange={(v) => setForm((f) => ({ ...f, seguimiento_auto: v }))}
            opciones={[
              { value: true, titulo: 'Activado', desc: 'El agente re-engancha cotizaciones sin cerrar (a los 45 min / 24 h / 48 h) y hace un check-in postventa. Solo en tu horario de atención; respeta a quien pide “baja”.' },
              { value: false, titulo: 'Desactivado', desc: 'El agente no envía mensajes de seguimiento por su cuenta.' },
            ]}
          />
        </div>
      </Seccion>

      <Seccion tone="amber" icono={Building2} titulo="Tiendas" sub="Sucursales para venta/reserva y recojo. Se guardan por separado.">
        <TiendasGestor />
      </Seccion>
        </>}
      />

      <SaveBar dirty={dirty} guardando={guardando} onGuardar={guardar} onDescartar={() => setForm(negocio)} />
    </div>
  )
}
