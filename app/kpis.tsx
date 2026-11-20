'use client'
import { Users, Flame, GitBranch, Trophy, Wallet, TrendingUp, Activity, ArrowUp, ArrowDown, type LucideIcon } from 'lucide-react'
import type { Conversacion } from '@/lib/core/conversaciones'
import type { PedidoGuardado } from '@/lib/core/schemas'

// Estilo compartido de todas las cards KPI: blanca, hairline, radio 12px y
// padding compacto (~14px). `flex-col` + `mt-auto` en el contenido hace que
// (a igual altura de grilla) llene la card de arriba a abajo, sin hueco inferior.
const CARD = 'flex h-full flex-col rounded-xl border-[0.5px] border-[#f0f0f3] bg-card p-3.5 shadow-[0_1px_2px_rgba(33,31,26,0.04)]'
// Cuadrito del icono: fondo TINT suave, icono del color de la métrica.
const ICONO_BOX = 'grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg'

// Un color por métrica, acorde a lo que mide ({bg tint, fg icono}).
type Color = { bg: string; fg: string }
const CIAN: Color = { bg: '#CFFAFE', fg: '#0891B2' }   // Leads (entrada)
const ROJO: Color = { bg: '#FCEBEB', fg: '#E24B4A' }   // Calientes (urgencia)
const TEAL: Color = { bg: '#D6F6FA', fg: '#0E7490' }   // Derivados (handoff)
const AMBAR: Color = { bg: '#FAEEDA', fg: '#B4801E' }  // Ventas ganadas (trofeo)
const VERDE: Color = { bg: '#E1F5EE', fg: '#0F6E56' }  // Vendido (dinero)
const AZUL: Color = { bg: '#E6F1FB', fg: '#378ADD' }   // Conversión (tasa)
const INDIGO: Color = { bg: '#EEEDFE', fg: '#3C3489' } // Actividad

// Delta W/W (variación positiva = verde, negativa = rojo). Se muestra solo si
// hay dato real; si no hay baseline previo, se omite (no inventamos métricas).
type Delta = { dir: 'up' | 'down'; texto: string }
function ChipDelta({ delta }: { delta: Delta }) {
  const pos = delta.dir === 'up'
  const Flecha = pos ? ArrowUp : ArrowDown
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${pos ? 'bg-[#E8FBF1] text-[#1E8E5A]' : 'bg-[#FFEAEC] text-[#C2474F]'}`}>
      <Flecha size={11} strokeWidth={2.5} aria-hidden />
      {delta.texto}
    </span>
  )
}

// Mini-gráfico de actividad: turnos atendidos por día (últimos 7 días).
function Actividad({ pedidos }: { pedidos: PedidoGuardado[] }) {
  const DIA = 24 * 3600_000
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const dias = Array.from({ length: 7 }, (_, i) => hoy.getTime() - (6 - i) * DIA)
  const cuentas = dias.map(
    (d) => pedidos.filter((p) => {
      const t = p.created_at ? new Date(p.created_at).getTime() : 0
      return t >= d && t < d + DIA
    }).length,
  )
  const max = Math.max(...cuentas, 1)
  return (
    <div className={CARD}>
      <span className={ICONO_BOX} style={{ background: INDIGO.bg, color: INDIGO.fg }}>
        <Activity size={18} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="mt-auto pt-3">
        <div className="flex h-7 items-end gap-1">
          {cuentas.map((n, i) => (
            <div
              key={i}
              title={`${n} turnos`}
              className={`flex-1 rounded-sm ${i === 6 ? 'bg-[#3C3489]' : 'bg-line'}`}
              style={{ height: `${Math.max((n / max) * 100, 6)}%` }}
            />
          ))}
        </div>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Actividad 7 días</p>
      </div>
    </div>
  )
}

function Kpi({ valor, etiqueta, icono: Icono, color, delta }: { valor: number | string; etiqueta: string; icono: LucideIcon; color: Color; delta?: Delta }) {
  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-2">
        <span className={ICONO_BOX} style={{ background: color.bg, color: color.fg }}>
          <Icono size={18} strokeWidth={1.75} aria-hidden />
        </span>
        {delta && <ChipDelta delta={delta} />}
      </div>
      <div className="mt-auto pt-3">
        <p className="font-display text-3xl font-semibold leading-none text-ink">{valor}</p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{etiqueta}</p>
      </div>
    </div>
  )
}

export function Kpis({ convs, pedidos }: { convs: Conversacion[]; pedidos: PedidoGuardado[] }) {
  const calientes = convs.filter((c) => c.temperatura === 'caliente' && !c.cierre).length
  const derivados = convs.filter((c) => c.derivado && !c.cierre).length
  const ganados = convs.filter((c) => c.cierre?.estado === 'ganado')
  const vendido = ganados.reduce((s, c) => s + (c.cierre?.monto ?? 0), 0)
  const conversion = convs.length ? Math.round((ganados.length / convs.length) * 100) : 0

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
      <Kpi valor={convs.length} etiqueta="Leads" icono={Users} color={CIAN} />
      <Kpi valor={calientes} etiqueta="Calientes ahora" icono={Flame} color={ROJO} />
      <Kpi valor={derivados} etiqueta="Derivados" icono={GitBranch} color={TEAL} />
      <Kpi valor={ganados.length} etiqueta="Ventas ganadas" icono={Trophy} color={AMBAR} />
      <Kpi valor={`S/${vendido.toFixed(0)}`} etiqueta="Vendido" icono={Wallet} color={VERDE} />
      <Kpi valor={`${conversion}%`} etiqueta="Conversión" icono={TrendingUp} color={AZUL} />
      <Actividad pedidos={pedidos} />
    </div>
  )
}
