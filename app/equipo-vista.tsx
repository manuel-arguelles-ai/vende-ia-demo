'use client'
import { useEffect, useState } from 'react'
import { Shuffle, ShieldCheck, UserPlus, Users, Eye, EyeOff, MoreHorizontal, Pencil, Power, Check } from 'lucide-react'
import { conBase } from '@/lib/base'
import { useToast } from './toast'
import { useConfirm } from './confirm'
import { mutar } from '@/lib/ui/fetchJson'
import { permisoDe, type Seccion, type Permiso } from '@/lib/core/permisos'
import { inicialesLead } from '@/lib/ui/lead'
import { Seccion as Card, ColumnasConfig } from './config-ui'
import { Select } from './select'

const SECCIONES: { key: Seccion; label: string; edit: boolean }[] = [
  { key: 'pipeline', label: 'Pipeline (conversaciones)', edit: true },
  { key: 'contactos', label: 'Contactos', edit: true },
  { key: 'pedidos', label: 'Pedidos', edit: false },
  { key: 'catalogo', label: 'Catálogo', edit: true },
]

type Kpis = { asignados: number; activos: number; cerrados: number; conversion: number }
type Usuario = {
  id: number
  nombre: string | null
  email: string
  rol: string
  activo: boolean
  leadsAsignados: number
  peso?: number
  limite_activos?: number
  kpis?: Kpis
  saturado?: boolean
}

const INP = 'rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20'

// Avatar de iniciales (nombre o email); color por rol.
function Avatar({ u }: { u: Usuario }) {
  const ini = inicialesLead(u.nombre || u.email)
  const admin = u.rol === 'admin'
  return (
    <span
      className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-xs font-bold"
      style={admin ? { background: '#EEEDFE', color: '#3C3489' } : { background: '#CFFAFE', color: '#0E7490' }}
    >
      {ini || '—'}
    </span>
  )
}

export function EquipoVista() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [form, setForm] = useState({ nombre: '', email: '', password: '' })
  const [neg, setNeg] = useState<Record<string, unknown> | null>(null)
  const [verPass, setVerPass] = useState(false)
  const [errCrear, setErrCrear] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<number | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const toast = useToast()
  const confirm = useConfirm()

  const cargar = () => fetch(conBase('/api/usuarios')).then((r) => (r.ok ? r.json() : [])).then(setUsuarios).catch(() => {})
  useEffect(() => { cargar() }, [])
  useEffect(() => { fetch(conBase('/api/negocio')).then((r) => r.ok ? r.json() : {}).then(setNeg).catch(() => {}) }, [])

  const asign = (neg?.asignacion as { regla?: string; limite_default?: number } | undefined) ?? { regla: 'off', limite_default: 20 }
  const manual = String(asign.regla) === 'off'

  async function guardarAsignacion(regla: string, limite: number) {
    const merged = { ...(neg ?? {}), asignacion: { regla, limite_default: limite, ultimo_asesor_id: (neg?.asignacion as { ultimo_asesor_id?: number | null })?.ultimo_asesor_id ?? null } }
    const r = await mutar(conBase('/api/negocio'), { method: 'PUT', body: JSON.stringify(merged) })
    if (!r.ok) return toast.error(r.error)
    toast.ok('Regla de asignación guardada')
    setNeg(merged)
  }

  async function guardarPermisos(seccion: Seccion, valor: Permiso) {
    const permisos = { ...((neg?.permisos_asesor as Record<string, Permiso>) ?? {}), [seccion]: valor }
    const merged = { ...(neg ?? {}), permisos_asesor: permisos }
    const r = await mutar(conBase('/api/negocio'), { method: 'PUT', body: JSON.stringify(merged) })
    if (!r.ok) return toast.error(r.error)
    toast.ok('Permisos actualizados')
    setNeg(merged)
  }

  function crear() {
    const faltan: string[] = []
    if (!form.nombre.trim()) faltan.push('nombre')
    if (!form.email.trim()) faltan.push('email')
    if (!form.password.trim()) faltan.push('contraseña')
    if (faltan.length) { setErrCrear(`Completa: ${faltan.join(', ')}`); return }
    setErrCrear(null)
    mutar(conBase('/api/usuarios'), { method: 'POST', body: JSON.stringify(form) }).then((r) => {
      if (r.ok) { setForm({ nombre: '', email: '', password: '' }); toast.ok('Asesor creado'); cargar() }
      else toast.error(r.error)
    })
  }

  async function toggle(u: Usuario) {
    setMenuId(null)
    if (u.activo) {
      const ok = await confirm({
        titulo: 'Desactivar asesor',
        mensaje: `${u.nombre ?? u.email} dejará de recibir leads y no podrá entrar. Puedes reactivarlo cuando quieras.`,
        confirmar: 'Desactivar',
        peligro: true,
      })
      if (!ok) return
    }
    const r = await mutar(conBase('/api/usuarios'), { method: 'PATCH', body: JSON.stringify({ id: u.id, activo: !u.activo }) })
    if (!r.ok) return toast.error(r.error)
    toast.ok(u.activo ? 'Asesor desactivado' : 'Asesor activado')
    cargar()
  }

  async function patchUsuario(id: number, patch: { nombre?: string; peso?: number; limite_activos?: number }) {
    await fetch(conBase('/api/usuarios'), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) })
    cargar()
  }

  function abrirEdicion(u: Usuario) {
    setEditId(u.id)
    setEditNombre(u.nombre ?? '')
    setMenuId(null)
  }
  async function guardarNombre(id: number) {
    await patchUsuario(id, { nombre: editNombre.trim() })
    setEditId(null)
    toast.ok('Nombre actualizado')
  }

  const errInput = (campo: 'nombre' | 'email' | 'password') => (errCrear && !form[campo].trim() ? '!border-caliente' : '')
  const setCampo = (campo: 'nombre' | 'email' | 'password', v: string) => { setForm({ ...form, [campo]: v }); if (errCrear) setErrCrear(null) }

  return (
    <div className="w-full max-w-[1600px] pb-4">
      <ColumnasConfig
        izquierda={<>
      {/* Asignación automática */}
      <Card tone="blue" icono={Shuffle} titulo="Asignación automática" sub="Cómo se reparten los leads entrantes entre los asesores.">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            ariaLabel="Regla de asignación"
            value={String(asign.regla)}
            onChange={(v) => guardarAsignacion(v, Number(asign.limite_default) || 20)}
            options={[
              { value: 'off', label: 'Manual' },
              { value: 'round_robin', label: 'Round-robin' },
              { value: 'ponderada', label: 'Ponderada (por peso)' },
              { value: 'carga', label: 'Por carga' },
            ]}
          />
          <label className={`flex items-center gap-2 text-xs ${manual ? 'text-muted/50' : 'text-muted'}`}>
            Límite activos/asesor:
            <input
              type="number"
              disabled={manual}
              defaultValue={Number(asign.limite_default) || 20}
              onBlur={(e) => guardarAsignacion(String(asign.regla), Number(e.target.value) || 20)}
              className={`${INP} w-20 disabled:opacity-50`}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">
          <b>Manual</b>: tú asignas cada lead. <b>Automático</b> (round-robin / ponderada / por carga): se reparten solos.
          El límite de activos por asesor solo aplica en modo automático.
        </p>
      </Card>

      </>}
        derecha={<>
      {/* Permisos de asesores */}
      <Card tone="purple" icono={ShieldCheck} titulo="Permisos de asesores" sub="Qué pueden ver y hacer tus asesores en cada sección. Aplica a todos.">
        <div className="grid gap-2 sm:grid-cols-2">
          {SECCIONES.map(({ key, label, edit }) => {
            let actual = permisoDe(neg?.permisos_asesor as Record<Seccion, Permiso> | undefined, key)
            if (!edit && actual === 'editar') actual = 'ver'
            return (
              <div key={key} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                <span className="text-ink">{label}</span>
                <Select
                  ariaLabel={`Permiso: ${label}`}
                  value={actual}
                  onChange={(v) => guardarPermisos(key, v as Permiso)}
                  options={[
                    { value: 'oculto', label: 'Oculto' },
                    { value: 'ver', label: 'Solo ver' },
                    ...(edit ? [{ value: 'editar', label: 'Ver y editar' }] : []),
                  ]}
                />
              </div>
            )
          })}
        </div>
      </Card>

      </>}
        wide={<>
      {/* Crear asesor */}
      <Card tone="green" icono={UserPlus} titulo="Crear asesor" sub="Se le crea una cuenta para atender leads desde el CRM.">
        <div className="grid gap-3 sm:grid-cols-3">
          <input className={`${INP} ${errInput('nombre')}`} placeholder="Nombre" value={form.nombre} onChange={(e) => setCampo('nombre', e.target.value)} />
          <input className={`${INP} ${errInput('email')}`} placeholder="Email" value={form.email} onChange={(e) => setCampo('email', e.target.value)} />
          <div className="relative">
            <input className={`${INP} w-full pr-9 ${errInput('password')}`} placeholder="Contraseña" type={verPass ? 'text' : 'password'} value={form.password} onChange={(e) => setCampo('password', e.target.value)} />
            <button type="button" tabIndex={-1} onClick={() => setVerPass((v) => !v)} aria-label={verPass ? 'Ocultar' : 'Mostrar'} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted transition hover:text-ink">
              {verPass ? <EyeOff size={16} strokeWidth={1.75} aria-hidden /> : <Eye size={16} strokeWidth={1.75} aria-hidden />}
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={crear} className="rounded-full bg-coral px-5 py-2 text-sm font-bold text-white transition hover:brightness-95">Crear</button>
          {errCrear && <span className="text-xs font-semibold text-caliente">{errCrear}</span>}
        </div>
      </Card>

      {/* Equipo (tabla) */}
      <Card tone="amber" icono={Users} titulo="Equipo" sub="Asesores y administradores del negocio.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="py-2 pr-3">Miembro</th>
                <th className="px-3 py-2">Rol</th>
                <th className="px-3 py-2">Leads</th>
                <th className="px-3 py-2">Activos</th>
                <th className="px-3 py-2">Cerrados</th>
                <th className="px-3 py-2">Conversión</th>
                <th className="px-3 py-2">Peso</th>
                <th className="px-3 py-2">Límite</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const asesor = u.rol === 'asesor'
                const admin = u.rol === 'admin'
                return (
                  <tr key={u.id} className={`border-t-[0.5px] border-[#f0f0f3] ${u.activo ? '' : 'opacity-70'}`}>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar u={u} />
                        <div className="min-w-0">
                          {editId === u.id ? (
                            <div className="flex items-center gap-1.5">
                              <input autoFocus value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className="w-40 rounded-lg border border-line bg-white px-2 py-1 text-sm outline-none focus:border-coral" placeholder="nombre…" />
                              <button onClick={() => guardarNombre(u.id)} className="grid h-7 w-7 place-items-center rounded-full bg-sage text-white" aria-label="Guardar"><Check size={14} strokeWidth={2.5} /></button>
                              <button onClick={() => setEditId(null)} className="text-xs text-muted">cancelar</button>
                            </div>
                          ) : (
                            <>
                              <p className="flex items-center gap-1.5 truncate font-medium text-ink">
                                {u.nombre || (admin ? 'Administrador' : u.email)}
                                {u.saturado && <span className="rounded-full bg-caliente-soft px-1.5 py-0.5 text-[10px] font-bold text-caliente">saturado</span>}
                              </p>
                              <p className="truncate text-xs text-muted">{u.email}</p>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={admin ? { background: '#EEEDFE', color: '#3C3489' } : { background: '#F5F5FA', color: '#8181A5' }}>
                        {admin ? 'Admin' : 'Asesor'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">{u.leadsAsignados}</td>
                    <td className="px-3 py-2.5">{u.kpis?.activos ?? '—'}</td>
                    <td className="px-3 py-2.5">{u.kpis?.cerrados ?? '—'}</td>
                    <td className="px-3 py-2.5">{u.kpis ? Math.round(u.kpis.conversion * 100) + '%' : '—'}</td>
                    <td className="px-3 py-2.5">
                      {asesor ? <input type="number" defaultValue={u.peso ?? 1} onBlur={(e) => patchUsuario(u.id, { peso: Number(e.target.value) || 1 })} className="w-16 rounded-lg border border-line px-2 py-1 text-xs" /> : <span className="text-xs text-muted">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {asesor ? <input type="number" defaultValue={u.limite_activos ?? 20} onBlur={(e) => patchUsuario(u.id, { limite_activos: Number(e.target.value) || 20 })} className="w-16 rounded-lg border border-line px-2 py-1 text-xs" /> : <span className="text-xs text-muted">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={u.activo ? { background: '#E1F5EE', color: '#0F6E56' } : { background: '#F1EFE8', color: '#8B897F' }}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="relative flex justify-end">
                        <button onClick={() => setMenuId((m) => (m === u.id ? null : u.id))} title="Acciones" className="rounded-full p-1.5 text-muted transition hover:bg-paper-2 hover:text-ink">
                          <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />
                        </button>
                        {menuId === u.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} aria-hidden />
                            <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-card py-1 text-left shadow-lg">
                              <button onClick={() => abrirEdicion(u)} className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-ink hover:bg-paper-2"><Pencil size={14} strokeWidth={1.75} /> Editar nombre</button>
                              {asesor && (
                                <button onClick={() => toggle(u)} className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-ink hover:bg-paper-2"><Power size={14} strokeWidth={1.75} /> {u.activo ? 'Desactivar' : 'Activar'}</button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
        </>}
      />
    </div>
  )
}
