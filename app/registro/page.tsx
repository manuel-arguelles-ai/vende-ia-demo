'use client'
import { useState, useRef } from 'react'
import { conBase } from '@/lib/base'
import { CampoLinea, PanelIlustracion, IconoMail, IconoTienda, IconoEtiqueta } from '../auth-ui'

type Paso = 1 | 2 | 3

export default function Registro() {
  const [paso, setPaso] = useState<Paso>(1)

  // Paso 1 — negocio
  const [nombre, setNombre] = useState('')
  const [rubro, setRubro] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorP1, setErrorP1] = useState<string | null>(null)
  const [cargandoP1, setCargandoP1] = useState(false)

  // Paso 2 — CSV
  const [csvTexto, setCsvTexto] = useState('')
  const [resultadoImport, setResultadoImport] = useState<{ importados: number; omitidas: number } | null>(null)
  const [errorP2, setErrorP2] = useState<string | null>(null)
  const [cargandoP2, setCargandoP2] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Paso 3 — snippet
  const [widgetKey, setWidgetKey] = useState('')
  const [copiado, setCopiado] = useState(false)

  const origen = typeof window !== 'undefined' ? window.location.origin : ''

  // ── Paso 1: registro ────────────────────────────────────────────────────────
  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    if (cargandoP1) return
    setCargandoP1(true)
    setErrorP1(null)
    try {
      const res = await fetch(conBase('/api/registro'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nombre, rubro, email, password }),
      })
      if (res.ok) {
        const data = (await res.json()) as { widget_key: string }
        setWidgetKey(data.widget_key)
        setPaso(2)
      } else if (res.status === 409) {
        setErrorP1('email ya registrado')
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setErrorP1(data.error ?? 'Error al registrar')
      }
    } catch {
      setErrorP1('No se pudo conectar')
    } finally {
      setCargandoP1(false)
    }
  }

  // ── Paso 2: importar CSV ────────────────────────────────────────────────────
  function onArchivoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setCsvTexto((ev.target?.result as string) ?? '')
    reader.readAsText(file, 'utf-8')
  }

  async function importarCSV(e: React.FormEvent) {
    e.preventDefault()
    if (cargandoP2 || !csvTexto.trim()) return
    setCargandoP2(true)
    setErrorP2(null)
    try {
      const res = await fetch(conBase('/api/catalogo/importar'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csv: csvTexto }),
      })
      const data = (await res.json()) as { importados?: number; omitidas?: number; error?: string }
      if (res.ok) {
        setResultadoImport({ importados: data.importados ?? 0, omitidas: data.omitidas ?? 0 })
        setPaso(3)
      } else {
        setErrorP2(data.error ?? 'Error al importar')
      }
    } catch {
      setErrorP2('No se pudo conectar')
    } finally {
      setCargandoP2(false)
    }
  }

  const snippet = `<script src="${origen}${conBase('/widget.js')}" data-key="${widgetKey}"></script>`

  async function copiar() {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch {}
  }

  const PASOS: { titulo: string; sub: string }[] = [
    { titulo: 'Conecta WhatsApp y la IA enciende tu CRM.', sub: 'Monta tu negocio en minutos.' },
    { titulo: 'Suma tu catálogo y la IA arranca a vender.', sub: 'Importa tus productos de un tiro.' },
    { titulo: '¡Todo listo! Tu CRM ya está encendido.', sub: 'Conecta el widget y recibe leads en vivo.' },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="relative z-10 grid min-h-screen lg:grid-cols-2">
      {/* Formulario (izquierda) — acento cálido (secundario) para acompañar la
          ilustración ámbar/naranja; redefine el token localmente sin tocar login. */}
      <div
        className="flex items-center justify-center px-6 py-10 sm:px-10"
        style={{ '--coral': '#e4682b', '--coral-soft': '#fde4d3' } as React.CSSProperties}
      >
        <div className="anim-subir w-full max-w-sm">
          {/* Indicador de paso */}
          <div className="mb-7 flex gap-2">
            {([1, 2, 3] as Paso[]).map((n) => (
              <div
                key={n}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${paso >= n ? 'bg-coral' : 'bg-line'}`}
              />
            ))}
          </div>

          {/* ── Paso 1 ── */}
          {paso === 1 && (
            <form onSubmit={registrar}>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-coral">vende-ia · Registro</p>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Tu negocio</h1>
              <p className="mt-1.5 text-sm text-muted">Crea tu cuenta en segundos</p>

              <div className="mt-7">
                <CampoLinea id="nombre" label="Nombre del negocio" icono={<IconoTienda />} required value={nombre} onChange={setNombre} />
                <CampoLinea id="rubro" label="Rubro" icono={<IconoEtiqueta />} placeholder="ej: retail, alimentos, servicios" required value={rubro} onChange={setRubro} />
                <CampoLinea id="email" label="Correo" type="email" icono={<IconoMail />} autoComplete="username" required value={email} onChange={setEmail} />
                <CampoLinea id="password" label="Contraseña" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={setPassword} />
              </div>

              {errorP1 && <p className="mt-4 text-sm font-semibold text-coral">{errorP1}</p>}

              <button
                type="submit"
                disabled={cargandoP1}
                className="mt-8 w-full rounded-xl bg-coral py-3 text-sm font-bold text-white shadow-[0_6px_18px_rgba(224,99,63,0.25)] transition hover:brightness-95 disabled:opacity-50"
              >
                {cargandoP1 ? 'Creando cuenta…' : 'Crear cuenta →'}
              </button>

              <p className="mt-6 text-center text-sm text-muted">
                ¿Ya tienes cuenta?{' '}
                <a href={conBase('/login')} className="font-semibold text-coral underline-offset-2 hover:underline">
                  Inicia sesión
                </a>
              </p>
            </form>
          )}

          {/* ── Paso 2 ── */}
          {paso === 2 && (
            <form onSubmit={importarCSV}>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-coral">vende-ia · Catálogo</p>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Sube tu catálogo</h1>
              <p className="mt-1.5 text-sm text-muted">
                CSV con columnas:{' '}
                <code className="rounded bg-paper-2 px-1 py-0.5 text-xs">nombre, precio, categoria, marca, descripcion, presentacion, stock, seccion</code>
              </p>

              <label className="mt-6 block text-[11px] font-semibold uppercase tracking-wider text-muted">Archivo CSV</label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="mt-1.5 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink hover:file:bg-paper-2"
                onChange={onArchivoChange}
              />

              <label className="mt-5 block text-[11px] font-semibold uppercase tracking-wider text-muted">O pega el CSV aquí</label>
              <textarea
                className="mt-1.5 w-full rounded-xl border border-line bg-card px-3.5 py-2.5 font-mono text-xs outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20"
                rows={6}
                placeholder="nombre,precio,categoria..."
                value={csvTexto}
                onChange={(e) => setCsvTexto(e.target.value)}
              />

              {errorP2 && <p className="mt-2 text-sm font-semibold text-coral">{errorP2}</p>}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setPaso(3)}
                  className="flex-1 rounded-xl border border-line py-3 text-sm font-semibold text-muted transition hover:bg-paper-2 hover:text-ink"
                >
                  Saltar
                </button>
                <button
                  type="submit"
                  disabled={cargandoP2 || !csvTexto.trim()}
                  className="flex-1 rounded-xl bg-coral py-3 text-sm font-bold text-white shadow-[0_6px_18px_rgba(224,99,63,0.25)] transition hover:brightness-95 disabled:opacity-50"
                >
                  {cargandoP2 ? 'Importando…' : 'Importar →'}
                </button>
              </div>
            </form>
          )}

          {/* ── Paso 3 ── */}
          {paso === 3 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-coral">vende-ia · Listo</p>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">¡Ya está!</h1>

              {resultadoImport && (
                <p className="mt-2 text-sm text-muted">
                  Catálogo importado: <strong>{resultadoImport.importados}</strong> productos
                  {resultadoImport.omitidas > 0 && `, ${resultadoImport.omitidas} omitidas`}.
                </p>
              )}

              <p className="mt-5 text-sm text-muted">
                Copia este snippet y pégalo en tu sitio web antes de <code className="rounded bg-paper-2 px-1 py-0.5 text-xs">{`</body>`}</code>:
              </p>

              <div className="relative mt-3">
                <pre className="overflow-x-auto rounded-xl border border-line bg-paper-2 px-4 py-3 font-mono text-xs">
                  {snippet}
                </pre>
                <button
                  type="button"
                  onClick={copiar}
                  className="absolute right-2 top-2 rounded-lg border border-line bg-card px-2 py-1 text-[10px] font-semibold text-muted transition hover:bg-paper-2 hover:text-ink"
                >
                  {copiado ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>

              <a
                href={conBase('/')}
                className="mt-7 block w-full rounded-xl bg-coral py-3 text-center text-sm font-bold text-white shadow-[0_6px_18px_rgba(224,99,63,0.25)] transition hover:brightness-95"
              >
                Ir al panel →
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Ilustración (derecha) */}
      <PanelIlustracion variant="registro" titulo={PASOS[paso - 1].titulo} subtitulo={PASOS[paso - 1].sub} />
    </main>
  )
}
