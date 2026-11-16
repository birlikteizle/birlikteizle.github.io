import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-gradient shadow-glow',
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-[58%] w-[58%] text-white" fill="currentColor">
        <path d="M9.2 7.1a.7.7 0 0 1 1.06-.6l7.1 4.4a.7.7 0 0 1 0 1.2l-7.1 4.4a.7.7 0 0 1-1.07-.6V7.1Z" />
        <circle cx="5.6" cy="12" r="1.55" opacity="0.9" />
      </svg>
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-40" />
    </span>
  )
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={cn('h-9 w-9', markClassName)} />
      <span className="font-display text-[17px] font-semibold tracking-tight text-zinc-50">
        Birlikte<span className="text-gradient"> İzle</span>
      </span>
    </span>
  )
}
