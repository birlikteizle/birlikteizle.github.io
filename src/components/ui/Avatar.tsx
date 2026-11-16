import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type PresenceStatus = 'online' | 'offline' | 'reconnecting' | 'unknown'

const SIZES: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-14 w-14 text-sm',
  xl: 'h-20 w-20 text-lg',
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('tr-TR')
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toLocaleUpperCase('tr-TR')
}

export function PresenceDot({
  status,
  className,
  withRing = true,
}: {
  status: PresenceStatus
  className?: string
  withRing?: boolean
}) {
  const color =
    status === 'online'
      ? 'bg-emerald-400'
      : status === 'reconnecting'
        ? 'bg-amber-400'
        : status === 'offline'
          ? 'bg-zinc-500'
          : 'bg-zinc-600'

  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 rounded-full',
        color,
        withRing && 'ring-2 ring-night-900',
        status === 'reconnecting' && 'animate-pulse',
        className,
      )}
      aria-label={
        status === 'online'
          ? 'Çevrimiçi'
          : status === 'reconnecting'
            ? 'Yeniden bağlanıyor'
            : status === 'offline'
              ? 'Çevrimdışı'
              : 'Durum bilinmiyor'
      }
    />
  )
}

interface AvatarProps {
  src?: string | null
  name: string
  size?: AvatarSize
  status?: PresenceStatus
  className?: string
}

export function Avatar({ src, name, size = 'md', status, className }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [src])

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'grid place-items-center overflow-hidden rounded-full bg-gradient-to-br from-night-600 to-night-800 font-semibold text-zinc-200 ring-1 ring-white/10',
          SIZES[size],
        )}
      >
        {src && !imageFailed ? (
          <img
            src={src}
            alt={name}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span aria-hidden>{initialsOf(name)}</span>
        )}
      </span>
      {status ? (
        <PresenceDot status={status} className="absolute -bottom-0.5 -right-0.5" />
      ) : null}
    </span>
  )
}
