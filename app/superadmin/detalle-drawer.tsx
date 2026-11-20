'use client'
import { useEffect, useState } from 'react'
import { conBase } from '@/lib/base'
import type { TenantMetricas } from '@/lib/core/plataforma'
import { estadoConfiguracion, type DetalleTenant } from '@/lib/core/superadmin-detalle'

function fmtSeg(s: number | null): string {
  if (s == null) return '—'
  if (s < 60) return `${Math.round(s)}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${(s / 3600).toFixed(1)}h`
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-zinc-800 py-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{titulo}</p>
      {children}
    </div>
  )
}
function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-3 py-0.5 text-sm"><span className="text-zinc-500">{k}</span><span className="text-right text-zinc-200">{v ?? '—'}</span></div>
}

// Ficha de inquilino para soporte del super-admin: métricas (de la fila) + config + actividad.
export function DetalleDrawer({ tenant, onCerrar }: { tenant: TenantMetricas; onCerrar: () => void }) {
  const [d, setD] = useState<DetalleTenant | null>(null)
  const [error, setError] = useState(false)
  const [exp, setExp] = useState<Set<string>>(new Set())
  const toggle = (caso: string) => setExp((s) => { const n = new Set(s); n.has(caso) ? n.delete(caso) : n.add(caso); return n })

  useEffect(() => {
    let vivo = true
    fetch(conBase(`/api/superadmin/tenant?id=${tenant.id}`))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => vivo && setD(j))
      .catch(() => vivo && setError(true))
    return () => { vivo = false }
  }, [tenant.id])

  const n = d?.negocio
  const a = d?.agente
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onCerrar}>
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-zinc-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">{tenant.nombre}</h2>
            <p className="text-xs text-zinc-500">{tenant.slug} · {tenant.plan} · {tenant.estado}</p>
          </div>
          <button onClick={onCerrar} className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">✕</button>
        </div>

        <Seccion titulo="Resumen (mes)">
          <KV k="Mensajes" v={tenant.mensajes} />
          <KV k="Consumo" v={`${tenant.consumoMes?.mensajes ?? 0} msg · ${Math.round((tenant.consumoMes?.tokens_llm ?? 0) / 1000)}k tok · ${tenant.consumoMes?.segundos_voz ?? 0}s voz`} />
          <KV k="Pedidos / Cierres" v={`${tenant.pedidos} / ${tenant.cierres}`} />
          <KV k="Conversión" v={`${Math.round((tenant.conversion ?? 0) * 100)}%`} />
          <KV k="WhatsApp" v={tenant.canal} />
          <KV k="Productos" v={tenant.productos} />
          <KV k="Límite excedido" v={tenant.limiteExcedido ? 'sí' : 'no'} />
        </Seccion>

        {error && <p className="py-4 text-sm text-red-400">No se pudo cargar el detalle.</p>}
        {!d && !error && <p className="py-4 text-sm text-zinc-500">Cargando detalle…</p>}

        {d && (() => {
          const cfg = estadoConfiguracion(d, { productos: tenant.productos, whatsappConectado: tenant.canal === 'conectado' })
          return (
          <>
            <Seccion titulo={`Avance de configuración · ${cfg.pct}%`}>
              <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${cfg.pct}%` }} />
              </div>
              {cfg.items.map((it) => (
                <p key={it.item} className={`text-sm ${it.ok ? 'text-zinc-300' : 'text-amber-400'}`}>
                  {it.ok ? '✓' : '○'} {it.item}{!it.ok && ' — falta'}
                </p>
              ))}
            </Seccion>

            {d.escenarios.length > 0 && (() => {
              const totTok = d.escenarios.reduce((s, e) => s + (e.tokens ?? 0), 0)
              return (
              <Seccion titulo={`Escenarios demo (${d.escenarios.length})${totTok ? ` · ${(totTok / 1000).toFixed(1)}k tok ≈ US$${(totTok * 0.4 / 1e6).toFixed(3)}` : ''}`}>
                <div className="space-y-1">
                  {d.escenarios.map((e) => (
                    <div key={e.caso}>
                      <button
                        type="button"
                        onClick={() => e.turnos?.length && toggle(e.caso)}
                        className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-sm ${e.turnos?.length ? 'cursor-pointer hover:bg-zinc-800/60' : 'cursor-default'}`}
                      >
                        <span className="w-3 text-zinc-600">{e.turnos?.length ? (exp.has(e.caso) ? '▾' : '▸') : ''}</span>
                        <span className="min-w-[2.4rem] rounded bg-zinc-800 px-1.5 py-0.5 text-center text-[11px] font-bold text-zinc-300">{e.caso}</span>
                        <span className="flex-1 min-w-0 truncate">
                          <span className="text-zinc-200">{e.titulo || e.nombre}</span>
                          {e.titulo && <span className="text-zinc-500"> · {e.nombre}</span>}
                        </span>
                        {e.tokens != null && <span className="whitespace-nowrap text-[10.5px] text-zinc-500" title="tokens LLM de este chat">{(e.tokens / 1000).toFixed(1)}k</span>}
                        {e.cierre ? <span className="whitespace-nowrap text-[11px] font-semibold text-emerald-400">🏆 {e.cierre}</span>
                          : e.enAtencion ? <span className="whitespace-nowrap text-[11px] text-sky-400">👤 atención</span>
                          : e.derivado ? <span className="whitespace-nowrap text-[11px] text-amber-400">↗ derivado</span>
                          : e.temperatura ? <span className="whitespace-nowrap text-[11px] text-zinc-500">{e.temperatura}{e.score != null ? ` ${e.score}` : ''}</span>
                          : <span className="text-[11px] text-zinc-600">—</span>}
                      </button>
                      {exp.has(e.caso) && e.turnos && (
                        <div className="ml-9 mb-1 mt-0.5 space-y-0.5 border-l border-zinc-800 pl-2">
                          {e.turnos.map((t, i) => (
                            <div key={i} className="flex justify-between gap-2 text-[11px]">
                              <span className="truncate text-zinc-500">👤 {t.msg}</span>
                              <span className="whitespace-nowrap text-zinc-400">{t.tokens.toLocaleString()} tok</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Seccion>
              )
            })()}

            {Object.keys(d.lifecycle).length > 0 && (
              <Seccion titulo="Ciclo de vida (leads)">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(d.lifecycle).sort((a, b) => b[1] - a[1]).map(([et, n]) => (
                    <span key={et} className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300">{et} · <b className="text-zinc-100">{n}</b></span>
                  ))}
                </div>
              </Seccion>
            )}

            <Seccion titulo="Tiempos de respuesta">
              <KV k="Agente (cliente→bot)" v={`${fmtSeg(d.tiempos.agenteMedianaS)} mediana · ${d.tiempos.muestras.agente} muestras`} />
              <KV k="Asesor (derivación→1er msg)" v={`${fmtSeg(d.tiempos.asesorMedianaS)} mediana · ${d.tiempos.muestras.asesor} muestras`} />
              {d.tiempos.porEtapa.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-600">Embudo de tiempos del agente por etapa</p>
                  {d.tiempos.porEtapa.map((e) => <KV key={e.etapa} k={e.etapa} v={`${fmtSeg(e.medianaS)} · ${e.n}`} />)}
                </div>
              )}
            </Seccion>

            <Seccion titulo="Negocio">
              <KV k="Modo venta" v={n?.modo_venta ?? 'cierre'} />
              <KV k="Cierre" v={(n?.cierre_auto ?? true) ? 'automático' : 'manual'} />
              <KV k="Seguimiento auto" v={n?.seguimiento_auto ? 'activo' : 'off'} />
              <KV k="Ventana turnos" v={d.ventanaTurnos} />
              <KV k="Modo demo (allowlist)" v={n?.allowlist_activo ? 'activo' : 'off'} />
              <KV k="Yape / Plin" v={[n?.yape, n?.plin].filter(Boolean).join(' · ')} />
              <KV k="Cuenta / CCI" v={[n?.cuenta, n?.cci].filter(Boolean).join(' · ')} />
              <KV k="Horario" v={n?.horario} />
            </Seccion>

            <Seccion titulo="Agente">
              <KV k="Nombre bot" v={a?.nombreBot} />
              <KV k="Rubro" v={a?.rubro} />
              <KV k="Tono · Cierre · Agresividad" v={`${a?.tono} · ${a?.intensidadCierre} · ${a?.agresividad}`} />
            </Seccion>

            <Seccion titulo={`Tiendas (${d.tiendas.length})`}>
              {d.tiendas.length === 0 ? <p className="text-sm text-zinc-600">Sin tiendas.</p> :
                d.tiendas.map((t) => <p key={t.id} className={`text-sm ${t.activa ? 'text-zinc-200' : 'text-zinc-600'}`}>{t.nombre} · {t.distrito ?? ''} {!t.activa && '(inactiva)'}</p>)}
            </Seccion>

            <Seccion titulo={`Asesores (${d.usuarios.length})`}>
              {d.usuarios.map((u) => <p key={u.id} className="text-sm text-zinc-300">{u.nombre ?? u.email} · {u.rol} {!u.activo && '(inactivo)'}</p>)}
            </Seccion>

            {d.alertas.length > 0 && (
              <Seccion titulo={`Alertas de fraude (${d.alertas.filter((x) => !x.resuelta).length} pendientes)`}>
                {d.alertas.slice(0, 5).map((al) => <p key={al.id} className="text-xs text-zinc-400">{al.autor} · {al.numero_detectado ?? ''} · {al.texto.slice(0, 50)}</p>)}
              </Seccion>
            )}

            <Seccion titulo="Últimos pedidos">
              {d.ultimosPedidos.length === 0 ? <p className="text-sm text-zinc-600">Sin pedidos.</p> :
                d.ultimosPedidos.slice(0, 6).map((p, i) => <p key={i} className="truncate text-xs text-zinc-400">{new Date(p.created_at).toLocaleDateString('es-PE')} · {p.producto ?? '—'} · {p.temperatura} ({p.score})</p>)}
            </Seccion>

            <Seccion titulo="Últimos cierres">
              {d.ultimosCierres.length === 0 ? <p className="text-sm text-zinc-600">Sin cierres.</p> :
                d.ultimosCierres.slice(0, 6).map((c, i) => <p key={i} className="text-xs text-zinc-400">{new Date(c.created_at).toLocaleDateString('es-PE')} · {c.estado}{c.tipo ? `/${c.tipo}` : ''}{c.monto ? ` · S/${c.monto}` : ''}</p>)}
            </Seccion>
          </>
          )
        })()}
      </div>
    </div>
  )
}
