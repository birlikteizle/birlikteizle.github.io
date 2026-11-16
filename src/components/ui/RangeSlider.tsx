import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { clamp, cn } from '@/lib/utils'

interface RangeSliderProps {
  value: number
  max: number
  buffered?: number
  step?: number
  disabled?: boolean
  ariaLabel: string
  formatValue?: (value: number) => string
  onChange?: (value: number) => void
  onCommit?: (value: number) => void
  className?: string
  trackClassName?: string
  accent?: 'brand' | 'white'
}

export function RangeSlider({
  value,
  max,
  buffered = 0,
  step = 0.1,
  disabled = false,
  ariaLabel,
  formatValue,
  onChange,
  onCommit,
  className,
  trackClassName,
  accent = 'brand',
}: RangeSliderProps) {
  const safeMax = max > 0 && Number.isFinite(max) ? max : 1
  const clampedValue = clamp(value, 0, safeMax)
  const [dragging, setDragging] = useState(false)
  const [dragValue, setDragValue] = useState(clampedValue)

  useEffect(() => {
    if (!dragging) setDragValue(clampedValue)
  }, [clampedValue, dragging])

  const displayValue = dragging ? dragValue : clampedValue
  const progress = clamp((displayValue / safeMax) * 100, 0, 100)
  const bufferProgress = clamp((buffered / safeMax) * 100, 0, 100)
  const isDisabled = disabled || max <= 0

  const commit = useCallback(
    (next: number) => {
      setDragging(false)
      onCommit?.(next)
    },
    [onCommit],
  )

  return (
    <div className={cn('group relative flex h-5 w-full items-center', className)}>
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/[0.12]',
          trackClassName,
        )}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white/[0.14] transition-[width] duration-300"
          style={{ width: `${bufferProgress}%` } as CSSProperties}
        />
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            accent === 'brand' ? 'bg-gradient-to-r from-brand-500 to-cyan-400' : 'bg-zinc-200',
            !dragging && 'transition-[width] duration-150',
          )}
          style={{ width: `${progress}%` } as CSSProperties}
        />
      </div>

      <input
        type="range"
        min={0}
        max={safeMax}
        step={step}
        value={displayValue}
        disabled={isDisabled}
        aria-label={ariaLabel}
        aria-valuetext={formatValue ? formatValue(displayValue) : undefined}
        className={cn('slider absolute inset-0 h-full w-full', isDisabled && 'cursor-not-allowed opacity-60')}
        onChange={(event) => {
          const next = Number(event.target.value)
          setDragging(true)
          setDragValue(next)
          onChange?.(next)
        }}
        onPointerDown={() => setDragging(true)}
        onPointerUp={(event) => commit(Number(event.currentTarget.value))}
        onPointerCancel={(event) => commit(Number(event.currentTarget.value))}
        onKeyUp={(event) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
            commit(Number(event.currentTarget.value))
          }
        }}
        onBlur={(event) => {
          if (dragging) commit(Number(event.currentTarget.value))
        }}
      />
    </div>
  )
}
