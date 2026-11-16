import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import Player from '@vimeo/player'
import type { PlayerEvents, PlayerHandle, PlayerProps } from '@/components/players/types'
import { clamp } from '@/lib/utils'

interface VimeoErrorData {
  name?: string
  message?: string
}

function mapVimeoError(error: VimeoErrorData): string {
  switch (error.name) {
    case 'PrivacyError':
      return 'Vimeo videosu gizlilik ayarları nedeniyle bu alan adında gömülemiyor.'
    case 'PasswordError':
      return 'Bu Vimeo videosu parola korumalı; gömülü oynatılamıyor.'
    case 'NotFoundError':
      return 'Vimeo videosu bulunamadı veya kaldırılmış.'
    default:
      return error.message ? `Vimeo: ${error.message}` : 'Vimeo videosu yüklenemedi.'
  }
}

export const VimeoPlayer = forwardRef<PlayerHandle, PlayerProps>(function VimeoPlayer(
  { source, events },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)
  const eventsRef = useRef<PlayerEvents>(events)
  eventsRef.current = events

  const cacheRef = useRef({
    currentTime: 0,
    duration: 0,
    rate: 1,
    paused: true,
    buffering: false,
  })

  useImperativeHandle(
    ref,
    () => ({
      play: async () => {
        const player = playerRef.current
        if (!player) return
        await player.play()
      },
      pause: () => {
        void playerRef.current?.pause().catch(() => undefined)
      },
      seek: (seconds) => {
        const target = Math.max(0, seconds)
        cacheRef.current.currentTime = target
        void playerRef.current
          ?.setCurrentTime(target)
          .then((actual) => {
            if (typeof actual === 'number') cacheRef.current.currentTime = actual
          })
          .catch(() => undefined)
      },
      setPlaybackRate: (rate) => {
        const sanitized = clamp(rate, 0.25, 4)
        void playerRef.current?.setPlaybackRate(sanitized).catch(() => undefined)
        cacheRef.current.rate = sanitized
      },
      getCurrentTime: () => cacheRef.current.currentTime,
      getDuration: () => cacheRef.current.duration,
      getPlaybackRate: () => cacheRef.current.rate,
      isPaused: () => cacheRef.current.paused,
      isBuffering: () => cacheRef.current.buffering,
      setVolume: (volume) => {
        void playerRef.current?.setVolume(clamp(volume, 0, 1)).catch(() => undefined)
      },
      setMuted: (muted) => {
        void playerRef.current?.setMuted(muted).catch(() => undefined)
      },
    }),
    [],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container || !source.embedUrl) return

    let disposed = false
    let player: Player | null = null
    let interval: number | undefined
    let polling = false

    const emitTime = () => {
      const cache = cacheRef.current
      eventsRef.current.onTimeUpdate(cache.currentTime, cache.duration, 0)
    }

    try {
      player = new Player(container, {
        url: source.embedUrl as `https://player.vimeo.com/video/${string}`,
        controls: false,
        autoplay: false,
        loop: false,
        keyboard: false,
        playsinline: true,
        dnt: true,
        title: false,
        byline: false,
        portrait: false,
        pip: false,
      })
      playerRef.current = player
    } catch (error) {
      eventsRef.current.onError(
        error instanceof Error ? error.message : 'Vimeo oynatıcısı oluşturulamadı.',
      )
      return
    }

    const vimeo = player

    vimeo.on('play', () => {
      cacheRef.current.paused = false
    })
    vimeo.on('pause', () => {
      cacheRef.current.paused = true
    })
    vimeo.on('ended', () => {
      cacheRef.current.paused = true
      eventsRef.current.onEnded()
    })
    vimeo.on('bufferstart', () => {
      cacheRef.current.buffering = true
    })
    vimeo.on('bufferend', () => {
      cacheRef.current.buffering = false
    })
    vimeo.on('timeupdate', (data) => {
      if (typeof data.seconds === 'number') cacheRef.current.currentTime = data.seconds
      if (typeof data.duration === 'number' && data.duration > 0) cacheRef.current.duration = data.duration
      emitTime()
    })
    vimeo.on('error', (error: VimeoErrorData) => {
      eventsRef.current.onError(mapVimeoError(error ?? {}))
    })

    const poll = async () => {
      if (disposed || polling) return
      polling = true
      try {
        const [current, duration, rate] = await Promise.all([
          vimeo.getCurrentTime(),
          vimeo.getDuration(),
          vimeo.getPlaybackRate(),
        ])
        if (disposed) return
        if (typeof current === 'number') cacheRef.current.currentTime = current
        if (typeof duration === 'number' && duration > 0) cacheRef.current.duration = duration
        if (typeof rate === 'number' && rate > 0) cacheRef.current.rate = rate
        emitTime()
      } catch {
        /* Oynatıcı hazır değil. */
      } finally {
        polling = false
      }
    }

    void vimeo
      .ready()
      .then(() => {
        if (disposed) return
        const frame = container.querySelector('iframe')
        if (frame) {
          frame.style.width = '100%'
          frame.style.height = '100%'
          frame.style.position = 'absolute'
          frame.style.inset = '0'
        }
        eventsRef.current.onReady()
        emitTime()
        interval = window.setInterval(() => void poll(), 600)
      })
      .catch((error: unknown) => {
        if (disposed) return
        eventsRef.current.onError(
          error instanceof Error ? error.message : 'Vimeo videosu yüklenemedi.',
        )
      })

    return () => {
      disposed = true
      if (interval) window.clearInterval(interval)
      playerRef.current = null
      void vimeo.destroy().catch(() => undefined)
    }
  }, [source.embedUrl])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full"
    />
  )
})
