import Link from 'next/link'
import { conBase } from '@/lib/base'

export default function SuscripcionPendiente() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-8 text-center shadow-sm">
        <div className="mb-4 text-5xl">⏳</div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Pago pendiente</h1>
        <p className="mt-3 text-sm text-muted">
          Tu pago está siendo procesado. Te avisaremos cuando se confirme.
          Puedes seguir usando vende-ia mientras tanto.
        </p>
        <Link
          href={conBase('/')}
          className="mt-6 inline-block w-full rounded-xl bg-coral px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-95"
        >
          Ir al CRM
        </Link>
      </div>
    </main>
  )
}
