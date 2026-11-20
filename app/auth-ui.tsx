'use client'
import { useState, type ReactNode } from 'react'

// ── Íconos de línea (currentColor, heredan el color del campo) ──────────────
const ICON = 'h-[18px] w-[18px]'
const svg = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
}

export const IconoMail = () => (
  <svg {...svg} className={ICON}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </svg>
)
export const IconoLock = () => (
  <svg {...svg} className={ICON}>
    <rect x="4" y="11" width="16" height="9" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
)
export const IconoUser = () => (
  <svg {...svg} className={ICON}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
)
export const IconoTienda = () => (
  <svg {...svg} className={ICON}>
    <path d="M3.5 9 5 4.5h14L20.5 9" />
    <path d="M4.5 9v10.5h15V9" />
    <path d="M3.5 9a2.4 2.4 0 0 0 4.6 0 2.4 2.4 0 0 0 4.6 0 2.4 2.4 0 0 0 4.6 0" />
    <path d="M9.5 19.5V14h5v5.5" />
  </svg>
)
export const IconoEtiqueta = () => (
  <svg {...svg} className={ICON}>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V5a2 2 0 0 1 2-2h8l7.6 7.6a2 2 0 0 1 0 2.8Z" />
    <circle cx="7.5" cy="7.5" r="1.4" />
  </svg>
)
const IconoOjo = () => (
  <svg {...svg} className={ICON}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const IconoOjoCerrado = () => (
  <svg {...svg} className={ICON}>
    <path d="M9.9 4.5A9.6 9.6 0 0 1 12 4.3c6 0 9.5 7.7 9.5 7.7a17 17 0 0 1-2.4 3.3M6.5 6.7C3.6 8.4 2.5 12 2.5 12s3.5 7.7 9.5 7.7a9 9 0 0 0 3.2-.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m3.5 3.5 17 17" />
  </svg>
)

// ── Campo de línea: subrayado gris que se "pinta" de coral al enfocar, con
// ícono al final. Para contraseñas, el ícono es un toggle de visibilidad. ──
export function CampoLinea({
  label,
  icono,
  type = 'text',
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  placeholder,
  id,
}: {
  label: string
  icono?: ReactNode
  type?: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  required?: boolean
  minLength?: number
  placeholder?: string
  id?: string
}) {
  const esPassword = type === 'password'
  const [ver, setVer] = useState(false)
  const tipo = esPassword ? (ver ? 'text' : 'password') : type

  return (
    <label htmlFor={id} className="group mt-6 block first:mt-0">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted transition-colors group-focus-within:text-coral">
        {label}
      </span>
      <span className="relative mt-1 flex items-center">
        <input
          id={id}
          type={tipo}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="peer w-full border-0 bg-transparent py-2 pr-7 text-[15px] text-ink outline-none placeholder:text-muted/60"
        />
        {/* Línea base gris + línea coral que crece desde la izquierda al enfocar */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-line" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 rounded-full bg-coral transition-transform duration-300 ease-out peer-focus:scale-x-100" />
        {/* Ícono al final: toggle si es password, estático si no */}
        {esPassword ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVer((v) => !v)}
            aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute right-0 text-muted transition-colors hover:text-ink peer-focus:text-coral"
          >
            {ver ? <IconoOjoCerrado /> : <IconoOjo />}
          </button>
        ) : (
          icono && (
            <span className="pointer-events-none absolute right-0 text-muted transition-colors peer-focus:text-coral">
              {icono}
            </span>
          )
        )}
      </span>
    </label>
  )
}

// ── Panel de ilustración: fondo vívido (ondas + glows) + escena isométrica ──
// La escena cambia por contexto: 'login' muestra el pipeline (resultado),
// 'registro' muestra la activación (recién montás el negocio).
export function PanelIlustracion({
  titulo,
  subtitulo,
  variant = 'login',
}: {
  titulo: string
  subtitulo: string
  variant?: 'login' | 'registro'
}) {
  const reg = variant === 'registro'
  return (
    <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-center">
      {/* Gradiente base — login usa el turquesa (color principal); registro usa
          el secundario cálido (ámbar → naranja) para diferenciar la activación. */}
      <div
        className="absolute inset-0"
        style={{
          background: reg
            ? 'linear-gradient(160deg, #F6B84E 0%, #F1913C 46%, #E4682B 100%)'
            : 'linear-gradient(160deg, #12ACCE 0%, #0891B2 46%, #0E7490 100%)',
        }}
      />
      {/* Patrón abstracto: ondas curvas + glows saturados */}
      <FondoOndas reg={reg} />

      {/* Ilustración + copy, encima del fondo */}
      <div className="relative z-10 flex flex-col items-center px-10">
        {reg ? <EscenaRegistro /> : <Tablero />}
        <h2 className="anim-subir mt-9 max-w-xs text-center font-display text-2xl font-semibold leading-snug text-white">
          {titulo}
        </h2>
        <p className="anim-subir mt-2 max-w-xs text-center text-sm text-white/75">{subtitulo}</p>
      </div>
    </div>
  )
}

// Fondo decorativo: glows saturados (blur) + ondas curvas + arcos abstractos.
function FondoOndas({ reg }: { reg: boolean }) {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <filter id="glowOndas" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="36" />
        </filter>
      </defs>
      <g filter="url(#glowOndas)">
        {reg ? (
          <>
            {/* Bloom cálido (luz que baña el ámbar/naranja) */}
            <circle cx="332" cy="116" r="126" fill="#FFE6B8" opacity="0.42" />
            <circle cx="116" cy="292" r="134" fill="#FFD37A" opacity="0.40" />
            <circle cx="302" cy="468" r="94" fill="#E0491F" opacity="0.30" />
          </>
        ) : (
          <>
            {/* Bloom claro arriba-derecha (luz que baña el turquesa) */}
            <circle cx="332" cy="116" r="126" fill="#CFFAFE" opacity="0.28" />
            <circle cx="90" cy="428" r="124" fill="#7CE7AC" opacity="0.34" />
            <circle cx="318" cy="556" r="106" fill="#075E76" opacity="0.35" />
          </>
        )}
      </g>
      {/* Ondas — capa clara (espuma) + capa oscura (profundidad, según tono) */}
      <path d="M0,602 C90,560 172,652 252,612 C322,578 372,600 400,584 L400,800 L0,800 Z" fill="#ffffff" opacity="0.10" />
      <path d="M0,664 C112,628 192,708 300,668 C352,648 380,660 400,650 L400,800 L0,800 Z" fill={reg ? '#B8431A' : '#0A5E76'} opacity="0.32" />
      {/* Arcos abstractos arriba */}
      <g fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="2">
        <path d="M-30,150 Q140,38 332,150" />
        <path d="M-30,186 Q150,72 360,182" />
      </g>
    </svg>
  )
}

// Proyección isométrica 2:1 reutilizable — mundo (x→der-abajo, y→izq-abajo, z→arriba).
function mkIso(ox: number, oy: number, S: number) {
  const P = (x: number, y: number, z: number): [number, number] => [
    ox + (x - y) * 0.866 * S,
    oy + (x + y) * 0.5 * S - z * S,
  ]
  const pts = (a: [number, number][]) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  // Cuboide: caras top + las dos frontales (right, front).
  const caras = (x0: number, y0: number, w: number, d: number, z0: number, z1: number) => {
    const A = P(x0, y0, z1), B = P(x0 + w, y0, z1), C = P(x0 + w, y0 + d, z1), E = P(x0, y0 + d, z1)
    const Cf = P(x0 + w, y0 + d, z0), Bf = P(x0 + w, y0, z0), Ef = P(x0, y0 + d, z0)
    return { top: pts([A, B, C, E]), right: pts([B, C, Cf, Bf]), front: pts([E, C, Cf, Ef]) }
  }
  return { P, pts, caras }
}

// Logo de WhatsApp (glifo blanco), reutilizado en ambas variantes.
const GlifoWhatsApp = () => (
  <g fill="#fff">
    <path d="M11.5 2.3a9.2 9.2 0 0 0-7.8 13.9L2.3 21l4.9-1.3a9.2 9.2 0 1 0 4.3-17.4Zm0 16.8a7.6 7.6 0 0 1-3.9-1.1l-.3-.2-2.9.8.8-2.8-.2-.3a7.6 7.6 0 1 1 6.5 3.6Z" />
    <path d="M9 6.7c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3c-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.8 2.8 4.4 3.8 2.2.9 2.6.7 3.1.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.2c-.3-.2-1.5-.8-1.7-.8-.2-.1-.4-.1-.6.1l-.7.9c-.1.2-.3.2-.5.1a6.1 6.1 0 0 1-1.8-1.2 7 7 0 0 1-1.3-1.6c-.1-.2 0-.4.1-.5l.4-.4.2-.4v-.4c0-.1-.6-1.5-.8-2Z" />
  </g>
)

// Matriz que "acuesta" la UI sobre el plano superior (z=zT) de la proyección
// iso: dentro de un <g transform>, se dibuja en coordenadas de mundo (x,y) y
// cae en perspectiva isométrica. Ejes: x→der-abajo, y→izq-abajo.
function planoTop(ox: number, oy: number, S: number, zT: number) {
  const a = 0.866 * S, h = 0.5 * S
  return `matrix(${a} ${h} ${-a} ${h} ${ox} ${oy - zT * S})`
}

// LOGIN — Tablero CRM isométrico: un "device" blanco (el resultado real) con
// cabecera (punto en vivo + chip IA) y una grilla de tarjetas de lead tinteadas
// por etapa (frío → tibio → ganado), más la insignia de venta ganada flotando.
// Compacto y denso, contrasta sobre el turquesa.
function Tablero() {
  const S = 40, ox = 176, oy = 96, zT = 0.34
  const W = 4.4, H = 3.6
  const { P, caras } = mkIso(ox, oy, S)
  const body = caras(0, 0, W, H, 0, zT)
  const [scx, scy] = P(W / 2, H / 2, -0.05)
  const M = planoTop(ox, oy, S, zT)

  // Maquetado (coords de mundo sobre el plano): cabecera + grilla 3×2.
  const m = 0.35, g = 0.18, hh = 0.5
  const cols = 3, rows = 2
  const cw = (W - 2 * m - (cols - 1) * g) / cols
  const y0 = m + hh + g
  const rd = (H - m - y0 - (rows - 1) * g) / rows
  const temp = ['var(--frio)', 'var(--tibio)', 'var(--coral)']

  const celdas: { c: number; r: number }[] = []
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) celdas.push({ c, r })
  const cellXY = (c: number, r: number) => ({
    x: m + c * (cw + g),
    y: y0 + r * (rd + g),
  })

  return (
    <svg viewBox="0 0 360 332" className="w-full max-w-sm" role="img"
      aria-label="Tu CRM en vivo: cada chat ordenado y calificado">
      {/* Sombra de contacto */}
      <ellipse cx={scx} cy={scy + 16} rx={132} ry={34} fill="var(--ink)" opacity="0.07" />

      {/* Cuerpo del device (blanco, para resaltar sobre el turquesa) */}
      <polygon points={body.front} fill="#cfdadd" />
      <polygon points={body.right} fill="#e4edee" />
      <polygon points={body.top} fill="#f7fbfc" stroke="var(--line)" strokeWidth="0.8" />

      {/* Pantalla del CRM (UI acostada en el plano superior) */}
      <g transform={M}>
        {/* Cabecera */}
        <rect x={m} y={m} width={W - 2 * m} height={hh} rx={0.12} fill="#eef4f6" />
        <rect x={m + 0.18} y={m + 0.16} width={1.1} height={0.16} rx={0.08} fill="var(--muted)" opacity="0.7" />
        {/* Punto "en vivo" */}
        <circle cx={W - m - 1.02} cy={m + hh / 2} r={0.09} fill="var(--sage)" />
        {/* Chip IA */}
        <rect x={W - m - 0.86} y={m + 0.13} width={0.68} height={0.24} rx={0.12} fill="var(--coral-soft)" />
        <circle cx={W - m - 0.7} cy={m + hh / 2} r={0.06} fill="var(--coral)" />
        <rect x={W - m - 0.56} y={m + 0.21} width={0.32} height={0.08} rx={0.04} fill="var(--coral)" opacity="0.7" />

        {/* Encabezados de columna (etapas) */}
        {temp.map((color, c) => {
          const { x } = cellXY(c, 0)
          return (
            <g key={`h${c}`}>
              <circle cx={x + 0.1} cy={y0 - g - 0.02} r={0.06} fill={color} />
              <rect x={x + 0.22} y={y0 - g - 0.08} width={cw * 0.62} height={0.1} rx={0.05} fill="var(--muted)" opacity="0.55" />
            </g>
          )
        })}

        {/* Tarjetas de lead */}
        {celdas.map(({ c, r }) => {
          const { x, y } = cellXY(c, r)
          const color = temp[c]
          return (
            <g key={`c${c}-${r}`}>
              {/* sombra sutil de la tarjeta */}
              <rect x={x + 0.05} y={y + 0.06} width={cw} height={rd} rx={0.12} fill="var(--ink)" opacity="0.06" />
              <rect x={x} y={y} width={cw} height={rd} rx={0.12} fill="#ffffff" stroke="var(--line)" strokeWidth="0.03" />
              {/* franja de etapa a la izquierda */}
              <rect x={x} y={y} width={0.08} height={rd} rx={0.04} fill={color} />
              {/* avatar */}
              <circle cx={x + 0.28} cy={y + rd / 2} r={0.15} fill={color} opacity="0.18" />
              <circle cx={x + 0.28} cy={y + rd / 2} r={0.15} fill="none" stroke={color} strokeWidth="0.025" />
              {/* líneas de texto */}
              <rect x={x + 0.5} y={y + rd / 2 - 0.2} width={cw * 0.44} height={0.1} rx={0.05} fill="var(--ink)" opacity="0.55" />
              <rect x={x + 0.5} y={y + rd / 2 + 0.02} width={cw * 0.3} height={0.08} rx={0.04} fill="var(--muted)" opacity="0.55" />
              {/* punto de temperatura */}
              <circle cx={x + cw - 0.16} cy={y + 0.18} r={0.07} fill={color} />
            </g>
          )
        })}
      </g>

      {/* WhatsApp: la fuente de los chats (verde, arriba-izquierda) */}
      <g className="anim-flotar-lento">
        <rect x="30" y="34" width="58" height="58" rx="18" fill="#25D366" />
        <g transform="translate(41 45) scale(1.45)"><GlifoWhatsApp /></g>
        {/* puntos "entrando" hacia el tablero */}
        <circle cx="96" cy="90" r="3.6" fill="#fff" opacity="0.9" />
        <circle cx="112" cy="102" r="3.4" fill="#fff" opacity="0.6" />
        <circle cx="128" cy="114" r="3.2" fill="#fff" opacity="0.35" />
      </g>

      {/* Insignia de venta ganada (blanca, arriba-derecha) */}
      <g className="anim-flotar-lento">
        <circle cx="300" cy="58" r="24" fill="#fff" />
        <path d="M290 58l6.5 6.5 12-14" stroke="var(--coral)" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

// REGISTRO — Activación: un teléfono isométrico mostrando el QR de WhatsApp que,
// al escanearse, "enciende" un núcleo de IA turquesa (color principal) sobre el
// fondo cálido secundario. El contraste complementario (naranja ↔ turquesa)
// cuenta la historia: conectás WhatsApp y la IA prende tu CRM.
function EscenaRegistro() {
  const S = 38, ox = 210, oy = 100, zT = 0.3
  const Wp = 2.6, Hp = 4.4
  const { P, caras } = mkIso(ox, oy, S)
  const body = caras(0, 0, Wp, Hp, 0, zT)
  const [scx, scy] = P(Wp / 2, Hp / 2, -0.05)
  const M = planoTop(ox, oy, S, zT)

  // Maquetado del teléfono (coords de mundo sobre el plano).
  const mp = 0.28, headH = 0.55
  const q = Wp - 2 * mp - 0.14          // lado del QR (cuadrado, casi todo el ancho)
  const qx = mp + (Wp - 2 * mp - q) / 2
  const qy = mp + headH + 0.28
  const n = 7, cell = q / n
  const finders = [[0, 0], [0, n - 3], [n - 3, 0]]  // esquinas [i,j]
  const enFinder = (i: number, j: number) =>
    finders.some(([fi, fj]) => i >= fi && i < fi + 3 && j >= fj && j < fj + 3)
  const datos: { i: number; j: number }[] = []
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (!enFinder(i, j) && (i * 5 + j * 3 + (i ^ j)) % 3 === 0) datos.push({ i, j })
  const statusY = qy + q + 0.24

  return (
    <svg viewBox="0 0 360 332" className="w-full max-w-sm" role="img"
      aria-label="Escanea el QR de WhatsApp y la IA enciende tu CRM">
      {/* Sombra de contacto */}
      <ellipse cx={scx} cy={scy + 16} rx={104} ry={30} fill="#7a2f10" opacity="0.18" />

      {/* Cuerpo del teléfono (blanco cálido, resalta sobre el naranja) */}
      <polygon points={body.front} fill="#e3d7c4" />
      <polygon points={body.right} fill="#efe7d9" />
      <polygon points={body.top} fill="#fffdf8" stroke="#e8ddca" strokeWidth="0.8" />

      {/* Pantalla del teléfono (UI acostada en el plano superior) */}
      <g transform={M}>
        {/* Cabecera de WhatsApp */}
        <rect x={mp} y={mp} width={Wp - 2 * mp} height={headH} rx={0.12} fill="#25D366" />
        <g transform={`translate(${mp + 0.1} ${mp + 0.1}) scale(0.019)`}><GlifoWhatsApp /></g>
        <rect x={mp + 0.62} y={mp + 0.17} width={0.9} height={0.11} rx={0.055} fill="#fff" opacity="0.95" />
        <rect x={mp + 0.62} y={mp + 0.34} width={0.58} height={0.09} rx={0.045} fill="#fff" opacity="0.6" />

        {/* Zona blanca del QR (quiet zone) */}
        <rect x={qx - 0.12} y={qy - 0.12} width={q + 0.24} height={q + 0.24} rx={0.1} fill="#fff" stroke="var(--line)" strokeWidth="0.03" />
        {/* Módulos de datos */}
        {datos.map(({ i, j }) => (
          <rect key={`m${i}-${j}`} x={qx + i * cell + cell * 0.1} y={qy + j * cell + cell * 0.1}
            width={cell * 0.8} height={cell * 0.8} rx={cell * 0.12} fill="var(--ink)" />
        ))}
        {/* Patrones de esquina (finders) */}
        {finders.map(([fi, fj], k) => {
          const fx = qx + fi * cell, fy = qy + fj * cell, fs = 3 * cell
          return (
            <g key={`f${k}`}>
              <rect x={fx} y={fy} width={fs} height={fs} rx={cell * 0.3} fill="var(--ink)" />
              <rect x={fx + cell * 0.62} y={fy + cell * 0.62} width={fs - cell * 1.24} height={fs - cell * 1.24} rx={cell * 0.22} fill="#fff" />
              <rect x={fx + cell} y={fy + cell} width={cell} height={cell} rx={cell * 0.18} fill="var(--ink)" />
            </g>
          )
        })}

        {/* Estado "escaneá para conectar" */}
        <circle cx={mp + 0.14} cy={statusY} r={0.075} fill="#25D366" />
        <rect x={mp + 0.3} y={statusY - 0.06} width={q * 0.72} height={0.11} rx={0.055} fill="var(--muted)" opacity="0.6" />
      </g>

      {/* Núcleo de IA "encendiéndose" (turquesa = color principal), arriba-derecha */}
      <g className="anim-flotar">
        {/* rayos de ignición */}
        <g stroke="#0891B2" strokeWidth="2.4" strokeLinecap="round" opacity="0.55">
          <path d="M300 24v-12" /><path d="M334 40l9-8" /><path d="M266 40l-9-8" />
          <path d="M340 66h12" /><path d="M260 66h-12" />
        </g>
        <circle cx="300" cy="58" r="27" fill="#0891B2" />
        <circle cx="300" cy="58" r="27" fill="#fff" opacity="0.14" />
        {/* chispa/estrella blanca dentro del núcleo */}
        <path d="M300 42 C302.2 54 304 55.8 316 58 C304 60.2 302.2 62 300 74 C297.8 62 296 60.2 284 58 C296 55.8 297.8 54 300 42 Z" fill="#fff" />
      </g>

      {/* Haz de energía: del teléfono al núcleo (puntos turquesa que crecen) */}
      <g className="anim-flotar-lento">
        <circle cx="244" cy="118" r="3" fill="#0891B2" opacity="0.4" />
        <circle cx="262" cy="104" r="3.6" fill="#0891B2" opacity="0.6" />
        <circle cx="280" cy="90" r="4.2" fill="#0891B2" opacity="0.8" />
      </g>

      {/* Burbujas de chat entrando (verde WhatsApp), arriba-izquierda */}
      <g className="anim-flotar">
        <rect x="30" y="52" width="78" height="30" rx="15" fill="#fff" />
        <circle cx="47" cy="67" r="5" fill="#25D366" />
        <rect x="58" y="63" width="40" height="7" rx="3.5" fill="var(--muted)" opacity="0.5" />
      </g>
    </svg>
  )
}
