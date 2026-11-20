import { describe, it, expect, vi } from 'vitest'
import { puedeVerRemitente } from '../visibilidad'

// DB falsa: scoped(db).from('control_leads').select('remitente').eq('tenant_id').eq('asignado_a')
// → doble .eq encadenado (scoped agrega el primer .eq de tenant_id).
function dbConAsignados(remitentes: string[]) {
  const eqAsignado = vi.fn().mockResolvedValue({ data: remitentes.map((r) => ({ remitente: r })) })
  const eqTenant = vi.fn(() => ({ eq: eqAsignado }))
  const select = vi.fn(() => ({ eq: eqTenant }))
  return { from: vi.fn(() => ({ select })) } as never
}

const ADMIN = { usuarioId: 1, tenantId: 1, rol: 'admin' }
const ASESOR = { usuarioId: 9, tenantId: 1, rol: 'asesor' }

describe('puedeVerRemitente', () => {
  it('admin puede sobre cualquier remitente (sin tocar DB)', async () => {
    const db = { from: vi.fn() } as never
    expect(await puedeVerRemitente(ADMIN, '51999@s.whatsapp.net', db)).toBe(true)
    expect((db as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled()
  })

  it('asesor puede solo sobre un remitente asignado a él', async () => {
    const db = dbConAsignados(['51111@s.whatsapp.net', '51222@s.whatsapp.net'])
    expect(await puedeVerRemitente(ASESOR, '51111@s.whatsapp.net', db)).toBe(true)
  })

  it('asesor NO puede sobre un remitente ajeno', async () => {
    const db = dbConAsignados(['51111@s.whatsapp.net'])
    expect(await puedeVerRemitente(ASESOR, '51999@s.whatsapp.net', db)).toBe(false)
  })

  it('asesor sin leads asignados → false', async () => {
    const db = dbConAsignados([])
    expect(await puedeVerRemitente(ASESOR, '51111@s.whatsapp.net', db)).toBe(false)
  })
})
