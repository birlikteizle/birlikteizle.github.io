import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'soft'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-gradient text-white shadow-glow hover:brightness-110 active:brightness-95 disabled:shadow-none',
  secondary:
    'border border-white/10 bg-white/[0.06] text-zinc-100 hover:border-white/20 hover:bg-white/[0.09]',
  ghost: 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100',
  outline: 'border border-white/15 text-zinc-200 hover:border-white/25 hover:bg-white/[0.05]',
  danger: 'border border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
  soft: 'bg-brand-500/12 text-brand-200 hover:bg-brand-500/20',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-xs font-semibold',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm font-semibold',
  lg: 'h-12 gap-2.5 rounded-xl px-6 text-sm font-semibold',
  icon: 'h-10 w-10 rounded-xl',
  'icon-sm': 'h-8 w-8 rounded-lg',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-night-950 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  )
})
