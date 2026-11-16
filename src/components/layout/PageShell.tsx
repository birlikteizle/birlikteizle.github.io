import type { ReactNode } from 'react'
import { Heart } from 'lucide-react'
import { AppHeader } from '@/components/layout/AppHeader'
import { cn } from '@/lib/utils'

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <AppHeader />
      <main className={cn('mx-auto w-full max-w-7xl flex-1 px-4 pb-14 pt-7 sm:px-6 sm:pt-10 lg:px-8', className)}>
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-[11px] text-zinc-600 sm:flex-row sm:px-6 lg:px-8">
        <p className="flex items-center gap-1.5">
          <Heart className="h-3 w-3 text-brand-400/70" />
          Birlikte İzle — senkron video izleme odaları
        </p>
        <p>
          DRM korumalı platformlar desteklenmez. Yalnızca gömülü oynatılabilen kaynaklar
          kullanılabilir.
        </p>
      </div>
    </footer>
  )
}
