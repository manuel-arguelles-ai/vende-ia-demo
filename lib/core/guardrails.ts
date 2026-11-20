// Guardrails de seguridad para la entrada del cliente (defensa en profundidad).
// Capa 1 (acá): detección/recorte ANTES de llamar al LLM.
// Capa 2: hardening del system prompt en conversar.ts/extraer.ts.

export const MAX_LARGO = 1000

// Recorta payloads gigantes (evita abuso de tokens / inyecciones largas).
export function recortar(mensaje: string): string {
  return mensaje.length > MAX_LARGO ? mensaje.slice(0, MAX_LARGO) : mensaje
}

// Patrones de inyección de prompt / jailbreak / exfiltración (es + en).
// Nota: usamos stems (ignor\w*) en vez de \b tras vocal acentuada, porque en JS
// \b no marca borde después de 'á'/'é' (no son \w) → fallaría con voseo (olvidá, actuá).
const PATRONES: RegExp[] = [
  /\b(ignor|olvid|descart)[\wáéíóú]*.{0,30}\b(instruccion|regla|prompt|sistema|anterior|previo|todo)/i,
  /\b(system\s*prompt|prompt\s*del\s*sistema|tus\s+(instruccion|reglas|directiv))/i,
  /\b(revel|mostr|dame|repet|imprim|cu[aá]l\s+es)[\wáéíóú]*.{0,40}\b(prompt|instruccion|regla|configuraci|api\s*key|token|clave|secret)/i,
  // Role-play: stems acotados a "X ser/que sos" — 'pretendo comprar' o 'el simulador' son legítimos.
  /\b(act[uú][\wáéíóú]*\s+como|comport[\wáéíóú]*\s+como|hac[\wáéíóú]*\s+pasar|haz\s+de\s+cuenta|pretend[eé]\s+(ser|que)|fing[íi][\wáéíóú]*\s+(ser|que)|simul[aá]\s+(ser|que))/i,
  /\b(a\s+partir\s+de\s+ahora|de\s+ahora\s+en\s+m[aá]s|desde\s+ahora)\b.{0,20}\b(sos|eres|ser[aá]s|actu)/i,
  /\b(eres|sos|ser[aá]s)\s+ahora\b/i,
  /\b(modo\s+(desarrollador|developer|dios|sin\s+restricciones)|jailbreak|DAN\b|do\s+anything\s+now)/i,
  /\b(ignore|disregard|forget)\b.{0,30}\b(instruction|rule|prompt|previous|above|everything)/i,
  /\b(you\s+are\s+now|act\s+as|pretend\s+to\s+be|from\s+now\s+on\s+you)\b/i,
  /(^|\s)(system|assistant|developer)\s*:/i, // intentos de inyectar roles
  /<\|.*?\|>|\[\/?(INST|SYS)\]/i, // tokens de chat templates
  /^\s*\/(reset|model|system|admin|clear|reload|debug|prompt)[-\w]*\b/i, // slash-commands (/reset-ai, /model)
  /\b(nueva\s+regla|regla\s+nueva|new\s+rule|cambi[aá][\wáéíóú]*\s+(las\s+)?reglas)\b/i,
  /\b(soy|somos)\s+(el\s+|la\s+|tu\s+)?(admin|administrador|desarrollador|programador|due[ñn][oa]|creador|soporte\s+t[eé]cnico)/i, // suplantación de autoridad
  /\b(list[aá]|mostr[aá]|muestr[aá]|dame|ens[eé]ñ[aá])[\wáéíóú]*.{0,40}\b(tablas?|base\s+de\s+datos|esquema|schema|columnas?|registros)\b/i, // enumeración de DB
  /\b(formato|lenguaje|consulta)\s+(de\s+)?(sql|json|csv|yaml)\b/i, // exfiltración por formato
  /\b(all\s+(of\s+)?my\s+previous\s+messages|mis\s+mensajes\s+anteriores|todo\s+(el\s+)?historial)\b/i, // volcado de historial
]

export function inyeccionDetectada(mensaje: string): boolean {
  return PATRONES.some((re) => re.test(mensaje))
}

// Respuesta segura cuando se detecta un intento (no se llama al LLM).
// Derivada del perfil del tenant para no filtrar marca "Nina" a otros tenants.
export function respuestaSegura(nombreBot?: string | null, negocioNombre?: string | null): string {
  const bot = nombreBot ?? 'el asistente'
  const negocio = negocioNombre ? ` de ${negocioNombre}` : ''
  return `¡Jaja! 🌱 Soy solo ${bot}, el asistente${negocio} para ayudarte con nuestros productos. ¿Buscás algo en particular? Te recomiendo encantado 👌`
}
