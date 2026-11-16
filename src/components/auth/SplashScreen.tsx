import { LogoMark } from '@/components/ui/Logo'

export function SplashScreen() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5">
      <div className="animate-pulse-soft">
        <LogoMark className="h-14 w-14 rounded-2xl" />
      </div>
      <div className="text-center">
        <p className="font-display text-lg font-semibold text-zinc-100">Birlikte İzle</p>
        <p className="mt-1 text-xs text-zinc-500">Oturum hazırlanıyor…</p>
      </div>
      <div className="h-1 w-28 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 animate-shimmer rounded-full bg-brand-gradient bg-[length:200%_100%]" />
      </div>
    </div>
  )
}
