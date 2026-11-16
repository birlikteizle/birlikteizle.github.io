import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode
  trailing?: ReactNode
  invalid?: boolean
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, containerClassName, leadingIcon, trailing, invalid, id, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className={cn('relative flex items-center', containerClassName)}>
      {leadingIcon ? (
        <span className="pointer-events-none absolute left-3.5 flex text-zinc-500" aria-hidden>
          {leadingIcon}
        </span>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={invalid || undefined}
        className={cn(
          'field',
          leadingIcon && 'pl-10',
          trailing && 'pr-12',
          invalid && 'border-rose-500/50 focus:border-rose-500/60 focus:ring-rose-500/10',
          className,
        )}
        {...props}
      />
      {trailing ? <div className="absolute right-2 flex items-center">{trailing}</div> : null}
    </div>
  )
})
