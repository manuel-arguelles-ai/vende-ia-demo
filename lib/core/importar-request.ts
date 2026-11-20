import { parsearArchivo } from './parsear-archivo'
import { parsearCSV, type Modo } from './importar-catalogo'

// Resuelve las filas + modo de un POST de import, sea multipart (archivo
// xlsx/csv binario), JSON {csv,modo}, o text/csv crudo. El JSON se detecta por
// contenido (no solo por header) para tolerar callers sin content-type.
export async function filasDeRequest(req: Request): Promise<{ filas: string[][]; modo: Modo }> {
  const ct = req.headers.get('content-type') ?? ''
  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData()
    const file = fd.get('file') as File | null
    const modo: Modo = (fd.get('modo') as string) === 'reemplazar' ? 'reemplazar' : 'actualizar'
    if (!file) return { filas: [], modo }
    const buf = Buffer.from(await file.arrayBuffer())
    return { filas: parsearArchivo(buf, file.name), modo }
  }
  const texto = await req.text()
  if (texto.trimStart().startsWith('{')) {
    try {
      const body = JSON.parse(texto) as { csv?: string; modo?: Modo }
      if (typeof body.csv === 'string') {
        const modo: Modo = body.modo === 'reemplazar' ? 'reemplazar' : 'actualizar'
        return { filas: parsearCSV(body.csv), modo }
      }
    } catch { /* no era JSON válido → tratar como CSV crudo */ }
  }
  return { filas: parsearCSV(texto), modo: 'actualizar' }
}
