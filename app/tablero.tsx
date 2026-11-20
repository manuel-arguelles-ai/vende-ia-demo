'use client'
import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar, type Vista } from './sidebar'
import { Panel } from './panel'
import { Conversaciones } from './conversaciones'
import { Contactos } from './contactos'
import { NegocioVista } from './negocio-vista'
import { CatalogoVista } from './catalogo-vista'
import { AutorizadosVista } from './autorizados-vista'
import { AlertasVista } from './alertas-vista'
import { SuscripcionVista } from './suscripcion-vista'
import { AgenteVista } from './agente-vista'
import { EquipoVista } from './equipo-vista'
import { Kpis } from './kpis'
import { Simulador } from './simulador'
import { AsesorHoy } from './asesor-hoy'
import { useDatos } from './useDatos'
import { useVistos } from './use-vistos'
import { conBase } from '@/lib/base'
import type { DatosNegocio } from '@/lib/core/negocio'
import { useTenantInfo } from './use-tenant-info'

const TITULOS: Record<Vista, string> = {
  pipeline: 'Pipeline',
  contactos: 'Contactos',
  pedidos: 'Pedidos',
  negocio: 'Mi negocio',
  agente: 'Mi Agente',
  catalogo: 'Catálogo',
  autorizados: 'Modo demo',
  alertas: 'Alertas de fraude',
  plan: 'Plan',
  equipo: 'Equipo',
}

// Ítem de la barra compacta (valor + etiqueta en línea).
function Item({ v, l, cls = 'text-ink' }: { v: string | number; l: string; cls?: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className={`font-display text-sm font-bold ${cls}`}>{v}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{l}</span>
    </span>
  )
}

// Barra compacta que aparece al scrollear el pipeline: los KPIs grandes se
// condensan en una línea informativa fija para no perder contexto mientras
// se escribe en el chat de abajo.
function BarraCompacta({ convs }: { convs: import('@/lib/core/conversaciones').Conversacion[] }) {
  const calientes = convs.filter((c) => c.temperatura === 'caliente' && !c.cierre).length
  const derivados = convs.filter((c) => c.derivado && !c.cierre).length
  const enAtencion = convs.filter((c) => c.enAtencion).length
  const ganados = convs.filter((c) => c.cierre?.estado === 'ganado')
  const vendido = ganados.reduce((s, c) => s + (c.cierre?.monto ?? 0), 0)

  return (
    <div className="anim-subir flex items-center gap-4 overflow-x-auto rounded-2xl border border-line bg-card px-4 py-2">
      <Item v={convs.length} l="leads" />
      <Item v={calientes} l="calientes" cls="text-caliente" />
      <Item v={derivados} l="derivados" cls="text-coral" />
      <Item v={enAtencion} l="en atención" cls="text-sage" />
      <Item v={ganados.length} l="ganadas" cls="text-sage" />
      <Item v={`S/${vendido.toFixed(0)}`} l="vendido" cls="text-sage" />
      <span className="ml-auto flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted">
        cierra el chat para ver el detalle
      </span>
    </div>
  )
}

// Shell de la app: sidebar de navegación + contenido full-width por vista.
export function Tablero() {
  const { convs, pedidos, vivo, refetch } = useDatos()
  const infoTenant = useTenantInfo()
  const esAsesor = infoTenant?.rol === 'asesor'
  const { esNuevo, marcarVisto, nuevos } = useVistos(
    convs.map((c) => c.remitente),
    infoTenant?.email ?? null,
  )
  const [vista, setVista] = useState<Vista>('pipeline')
  const [movilAbierto, setMovilAbierto] = useState(false)
  const [negocio, setNegocio] = useState<DatosNegocio>({})
  // Con un chat abierto, los KPIs grandes se colapsan a la línea compacta
  // y el pipeline pasa a modo app (sin scroll de página, scrolls internos).
  const [chatAbierto, setChatAbierto] = useState(false)
  // Remitente a abrir programáticamente en el pipeline (ej. clic en una alerta).
  const [abrirRemitente, setAbrirRemitente] = useState<string | null>(null)

  // Setear el título de la pestaña con el nombre del inquilino.
  useEffect(() => {
    if (infoTenant?.nombre) document.title = `${infoTenant.nombre} · CRM en vivo`
  }, [infoTenant?.nombre])

  // Config del negocio: una sola carga (la editan la vista Negocio y el copiloto la usa).
  useEffect(() => {
    fetch(conBase('/api/negocio'))
      .then((r) => (r.ok ? r.json() : {}))
      .then(setNegocio)
      .catch(() => {})
  }, [])

  return (
    <div className="relative z-10 flex min-h-screen xl:h-screen xl:overflow-hidden">
      <Sidebar vista={vista} setVista={setVista} movilAbierto={movilAbierto} setMovilAbierto={setMovilAbierto} />

      <main className="flex min-w-0 flex-1 flex-col px-6 py-4 lg:px-8 xl:h-screen">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            {/* Abrir el menú (solo mobile) */}
            <button
              onClick={() => setMovilAbierto(true)}
              aria-label="Abrir menú"
              className="rounded-lg p-1.5 text-muted outline-none transition hover:bg-paper-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-coral lg:hidden"
            >
              <Menu size={22} strokeWidth={1.75} aria-hidden />
            </button>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{TITULOS[vista]}</h1>
          </span>
          <span className="flex items-center gap-3">
            {/* Indicador de estado (no acción): solo punto + texto muted */}
            <span
              className="flex items-center gap-2 text-xs font-semibold text-muted"
              title={vivo ? 'Datos en tiempo real vía Supabase' : 'Actualización periódica cada 4 s'}
            >
              <span
                className={`h-2 w-2 rounded-full ${vivo ? 'dot-vivo' : ''}`}
                style={{ background: vivo ? '#1D9E75' : '#8181A5' }}
              />
              {vivo ? 'En vivo' : 'Sincronizando'}
            </span>
            {(vista === 'contactos' || vista === 'pedidos') && (
              <>
                <span aria-hidden className="h-4 w-px bg-[#f0f0f3]" />
                <a
                  href={conBase(`/api/export?tipo=${vista}`)}
                  title={`Exportar ${vista} a CSV`}
                  className="rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-muted transition hover:text-ink"
                >
                  ⬇ Exportar CSV
                </a>
              </>
            )}
          </span>
        </header>

        <div className="scroll-contenido mt-6 flex min-h-0 flex-1 flex-col space-y-6 xl:overflow-y-auto">
          {vista === 'pipeline' && (
            <>
              {chatAbierto ? (
                <BarraCompacta convs={convs} />
              ) : esAsesor ? (
                <AsesorHoy convs={convs} nuevos={nuevos} nombre={infoTenant?.usuarioNombre} />
              ) : (
                <>
                  <Kpis convs={convs} pedidos={pedidos} />
                  <div className="max-w-2xl">
                    <Simulador onProcesado={refetch} />
                  </div>
                </>
              )}
              <Conversaciones
                convs={convs}
                refetch={refetch}
                negocio={negocio}
                onChatAbierto={setChatAbierto}
                esNuevo={esNuevo}
                marcarVisto={marcarVisto}
                lista={esAsesor}
                abrirRemitente={abrirRemitente}
                onAbrirConsumido={() => setAbrirRemitente(null)}
              />
            </>
          )}
          {vista === 'contactos' && <Contactos convs={convs} />}
          {vista === 'pedidos' && (
            <Panel
              pedidos={pedidos}
              convs={convs}
              onAbrirEnPipeline={(rem) => { setAbrirRemitente(rem); setVista('pipeline') }}
            />
          )}
          {vista === 'negocio' && <NegocioVista negocio={negocio} setNegocio={setNegocio} />}
          {vista === 'agente' && <AgenteVista />}
          {vista === 'catalogo' && <CatalogoVista />}
          {vista === 'autorizados' && <AutorizadosVista negocio={negocio} setNegocio={setNegocio} />}
          {vista === 'alertas' && (
            <AlertasVista
              onAbrirConversacion={(rem) => { setAbrirRemitente(rem); setVista('pipeline') }}
            />
          )}
          {vista === 'plan' && <SuscripcionVista />}
          {vista === 'equipo' && <EquipoVista />}
        </div>
      </main>
    </div>
  )
}
