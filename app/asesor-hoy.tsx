'use client'
import type { Conversacion } from '@/lib/core/conversaciones'

// Primera pantalla del asesor: lo accionable de HOY, calculado de sus leads
// (ya filtrados server-side). Reemplaza los KPIs de negocio (del dueño).
function Pastilla({ n, label, tono, activo }: { n: number; label: string; tono: string; activo: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 ${activo ? tono : 'border-line bg-card'}`}>
      <span className={`font-display text-2xl font-bold leading-none ${activo ? '' : 'text-muted'}`}>{n}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
    </div>
  )
}

export function AsesorHoy({ convs, nuevos, nombre }: { convs: Conversacion[]; nuevos: number; nombre?: string | null }) {
  const ahora = Date.now()
  const calientes = convs.filter((c) => c.temperatura === 'caliente' && !c.cierre && !c.enAtencion).length
  const vencidos = convs.filter(
    (c) => c.recordatorio && new Date(c.recordatorio).getTime() <= ahora && !c.cierre,
  ).length
  const derivados = convs.filter((c) => c.derivado && !c.cierre).length
  const enAtencion = convs.filter((c) => c.enAtencion).length

  const totalAccion = calientes + vencidos + derivados + nuevos

  return (
    <div className="anim-subir space-y-2.5">
      <p className="text-sm font-semibold text-ink">
        {`Hola${nombre ? ` ${nombre.split(' ')[0]}` : ''} 👋 — ${totalAccion > 0 ? 'esto necesita tu atención hoy' : 'estás al día ✨'}`}
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-5">
        <Pastilla n={nuevos} label="Sin abrir" tono="border-coral/30 bg-coral-soft text-coral" activo={nuevos > 0} />
        <Pastilla n={calientes} label="Calientes sin atender" tono="border-coral/30 bg-coral-soft text-coral" activo={calientes > 0} />
        <Pastilla n={vencidos} label="Seguimientos vencidos" tono="border-coral/30 bg-coral-soft text-coral" activo={vencidos > 0} />
        <Pastilla n={derivados} label="Derivados a vos" tono="border-sage/30 bg-sage-soft text-sage" activo={derivados > 0} />
        <Pastilla n={enAtencion} label="En tu atención" tono="border-sage/30 bg-sage-soft text-sage" activo={enAtencion > 0} />
      </div>
    </div>
  )
}
