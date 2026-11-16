import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { PlayerEvents, PlayerHandle, PlayerProps } from '@/components/players/types'
import { clamp } from '@/lib/utils'

interface YTPlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlaybackRate: () => number
  setPlaybackRate: (rate: number) => void
  getPlayerState: () => number
  getVideoLoadedFraction: () => number
  setVolume: (volume: number) => void
  mute: () => void
  unMute: () => void
  destroy: () => void
}

interface YTEvent {
  target: YTPlayer
  data: number
}

interface YTPlayerOptions {
  videoId: string
  host?: string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: () => void
    onStateChange?: (event: YTEvent) => void
    onError?: (event: YTEvent) => void
  }
}

interface YouTubeWindow extends Window {
  YT?: {
    Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer
  }
  onYouTubeIframeAPIReady?: () => void
}

let apiPromise: Promise<void> | null = null

function loadYouTubeApi(): Promise<void> {
  const ytWindow = window as YouTubeWindow
  if (ytWindow.YT?.Player) return Promise.resolve()
  if (apiPromise) return apiPromise

  apiPromise = new Promise<void>((resolve, reject) => {
    const existingCallback = ytWindow.onYouTubeIframeAPIReady
    const timeout = window.setTimeout(() => {
      apiPromise = null
      reject(new Error('YouTube oynatıcı API’si zamanında yüklenemedi. Bağlantınızı kontrol edin.'))
    }, 15_000)

    ytWindow.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout)
      existingCallback?.()
      resolve()
    }

    if (!document.getElementById('youtube-iframe-api')) {
      const script = document.createElement('script')
      script.id = 'youtube-iframe-api'
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => {
        window.clearTimeout(timeout)
        apiPromise = null
        script.remove()
        reject(new Error('YouTube oynatıcı API’si yüklenemedi. Reklam engelleyicinizi kontrol edin.'))
      }
      document.head.appendChild(script)
    }
  })

  return apiPromise
}

function mapYouTubeError(code: number): string {
  switch (code) {
    case 2:
      return 'YouTube video kimliği geçersiz.'
    case 5:
      return 'YouTube bu videoyu HTML5 oynatıcıda oynatamadı.'
    case 100:
      return 'Video bulunamadı, kaldırılmış veya gizli.'
    case 101:
    case 150:
      return 'Video sahibi gömülü oynatmayı kapatmış. Videoyu harici sekmede açabilirsiniz.'
    default:
      return 'YouTube videosu yüklenemedi.'
  }
}

export const YouTubePlayer = forwardRef<PlayerHandle, PlayerProps>(function YouTubePlayer(
  { source, events },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const eventsRef = useRef<PlayerEvents>(events)
  eventsRef.current = events

  const volumeRef = useRef(0.8)
  const mutedRef = useRef(false)

  useImperativeHandle(
    ref,
    () => ({
      play: async () => {
        playerRef.current?.playVideo()
      },
      pause: () => playerRef.current?.pauseVideo(),
      seek: (seconds) => playerRef.current?.seekTo(Math.max(0, seconds), true),
      setPlaybackRate: (rate) => playerRef.current?.setPlaybackRate(rate),
      getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
      getDuration: () => playerRef.current?.getDuration() ?? 0,
      getPlaybackRate: () => playerRef.current?.getPlaybackRate() ?? 1,
      isPaused: () => {
        const state = playerRef.current?.getPlayerState()
        return state !== 1 && state !== 3
      },
      isBuffering: () => playerRef.current?.getPlayerState() === 3,
      setVolume: (volume) => {
        volumeRef.current = clamp(volume, 0, 1)
        playerRef.current?.setVolume(Math.round(volumeRef.current * 100))
        if (volumeRef.current > 0 && mutedRef.current) {
          mutedRef.current = false
          playerRef.current?.unMute()
        }
      },
      setMuted: (muted) => {
        mutedRef.current = muted
        if (muted) playerRef.current?.mute()
        else {
          playerRef.current?.unMute()
          playerRef.current?.setVolume(Math.round(volumeRef.current * 100))
        }
      },
    }),
    [],
  )

  useEffect(() => {
    let disposed = false
    let interval: number | undefined
    let player: YTPlayer | null = null

    const emitTime = () => {
      if (!player || disposed) return
      try {
        const current = player.getCurrentTime()
        const duration = player.getDuration()
        const loaded = player.getVideoLoadedFraction()
        eventsRef.current.onTimeUpdate(current, duration, loaded > 0 ? loaded * duration : 0)
      } catch {
        /* Oynatıcı hazır değil. */
      }
    }

    void loadYouTubeApi()
      .then(() => {
        if (disposed || !containerRef.current) return
        const ytWindow = window as YouTubeWindow
        if (!ytWindow.YT) {
          eventsRef.current.onError('YouTube oynatıcı API’si yüklenemedi.')
          return
        }

        player = new ytWindow.YT.Player(containerRef.current, {
          videoId: source.videoId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (disposed) return
              playerRef.current = player
              player?.setVolume(Math.round(volumeRef.current * 100))
              if (mutedRef.current) player?.mute()
              eventsRef.current.onReady()
              emitTime()
              interval = window.setInterval(emitTime, 250)
            },
            onStateChange: (event) => {
              if (event.data === 0) eventsRef.current.onEnded()
              if (event.data === 1 || event.data === 2 || event.data === 0) emitTime()
            },
            onError: (event) => {
              eventsRef.current.onError(mapYouTubeError(event.data))
            },
          },
        })
        playerRef.current = player
      })
      .catch((error: unknown) => {
        if (disposed) return
        eventsRef.current.onError(
          error instanceof Error ? error.message : 'YouTube oynatıcı yüklenemedi.',
        )
      })

    return () => {
      disposed = true
      if (interval) window.clearInterval(interval)
      playerRef.current = null
      try {
        player?.destroy()
      } catch {
        /* iframe zaten kaldırılmış olabilir. */
      }
    }
  }, [source.videoId])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full" />
    </div>
  )
})
