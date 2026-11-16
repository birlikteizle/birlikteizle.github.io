import { Link } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'

export function NotFoundPage() {
  return (
    <PageShell>
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center py-12 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-brand-300">
          <Compass className="h-7 w-7" />
        </span>
        <p className="mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-600">
          404
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-zinc-50">Sayfa bulunamadı</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Aradığın sayfa taşınmış veya hiç var olmamış olabilir. Davet bağlantıları
          <code className="mx-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
            /room/…
          </code>
          biçimindedir.
        </p>
        <Link
          to="/"
          className="mt-7 inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-night-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Ana sayfaya dön
        </Link>
      </div>
    </PageShell>
  )
}
