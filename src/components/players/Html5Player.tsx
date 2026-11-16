import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type Hls from 'hls.js'
import type { PlayerEvents, PlayerHandle, PlayerProps } from '@/components/players/types'
import { clamp } from '@/lib/utils'

function bufferedEnd(video: HTMLVideoElement): number {
  const ranges = video.buffered
  if (!ranges.length) return 0
  return ranges.end(ranges.length - 1)
}

function mapMediaError(video: HTMLVideoElement, provider: 'html5' | 'hls'): string {
  const error = video.error
  if (!error) return 'Video yüklenemedi.'
  switch (error.code) {
    case 1:
      return 'Video yükleme işlemi iptal edildi.'
    case 2:
      return 'Video indirilemedi. Bağlantı erişilebilir mi? Sunucu CORS veya hotlink koruması uyguluyor olabilir.'
    case 3:
      return 'Video çözülemedi. Dosya bozuk olabilir veya tarayıcı bu codec bileşenini desteklemiyor.'
    case 4:
      return provider === 'hls'
        ? 'HLS akışı oynatılamadı. Tarayıcı bu akışı desteklemiyor veya akış CORS başlıklarına izin vermiyor olabilir.'
        : 'Bu video biçimi tarayıcınız tarafından desteklenmiyor. MP4 (H.264) veya WebM deneyin.'
    default:
      return 'Video oynatılırken bir hata oluştu.'
  }
}

export const Html5Player = forwardRef<PlayerHandle, PlayerProps>(function Html5Player(
  { source, events },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const eventsRef = useRef<PlayerEvents>(events)
  eventsRef.current = events

  useImperativeHandle(
    ref,
    () => ({
      play: async () => {
        const video = videoRef.current
        if (!video) return
        await video.play()
      },
      pause: () => videoRef.current?.pause(),
      seek: (seconds) => {
        const video = videoRef.current
        if (!video) return
        const duration = Number.isFinite(video.duration) ? video.duration : seconds
        const target = clamp(seconds, 0, duration > 0 ? duration : seconds)
        try {
          video.currentTime = target
        } catch {
          /* metadata henüz yüklenmemiş olabilir. */
        }
      },
      setPlaybackRate: (rate) => {
        if (videoRef.current) videoRef.current.playbackRate = clamp(rate, 0.25, 4)
      },
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
      getDuration: () => {
        const duration = videoRef.current?.duration
        return typeof duration === 'number' && Number.isFinite(duration) ? duration : 0
      },
      getPlaybackRate: () => videoRef.current?.playbackRate ?? 1,
      isPaused: () => videoRef.current?.paused ?? true,
      isBuffering: () => {
        const video = videoRef.current
        if (!video) return true
        return video.readyState < 3 && !video.paused && !video.ended
      },
      setVolume: (volume) => {
        if (videoRef.current) videoRef.current.volume = clamp(volume, 0, 1)
      },
      setMuted: (muted) => {
        if (videoRef.current) videoRef.current.muted = muted
      },
    }),
    [],
  )

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let disposed = false
    let readyFired = false
    let hls: Hls | null = null

    const fireReady = () => {
      if (disposed || readyFired) return
      readyFired = true
      eventsRef.current.onReady()
    }

    const emitTime = () => {
      if (disposed) return
      eventsRef.current.onTimeUpdate(
        video.currentTime || 0,
        Number.isFinite(video.duration) ? video.duration : 0,
        bufferedEnd(video),
      )
    }

    const handleLoadedMetadata = () => {
      emitTime()
      fireReady()
    }

    const handleCanPlay = () => fireReady()
    const handleTimeUpdate = () => emitTime()
    const handleProgress = () => emitTime()
    const handleEnded = () => eventsRef.current.onEnded()
    const handleError = () => {
      if (disposed || video.error?.code === 1) return
      eventsRef.current.onError(mapMediaError(video, source.provider === 'hls' ? 'hls' : 'html5'))
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('progress', handleProgress)
    video.addEventListener('durationchange', emitTime)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)

    const setup = async () => {
      if (source.provider === 'hls') {
        const nativeHls = video.canPlayType('application/vnd.apple.mpegurl')
        if (nativeHls) {
          video.src = source.url
          video.load()
          return
        }

        const { default: HlsPlayer } = await import('hls.js')
        if (disposed) return
        if (!HlsPlayer.isSupported()) {
          eventsRef.current.onError('Tarayıcınız HLS oynatmayı desteklemiyor.')
          return
        }

        hls = new HlsPlayer({ enableWorker: true })
        hlsRef.current = hls
        hls.loadSource(source.url)
        hls.attachMedia(video)
        hls.on(HlsPlayer.Events.ERROR, (_event, data) => {
          if (!data.fatal) return
          if (data.type === HlsPlayer.ErrorTypes.NETWORK_ERROR) {
            eventsRef.current.onError(
              'HLS akışı yüklenemedi. Akış adresi erişilebilir mi ve CORS başlıklarına izin veriyor mu?',
            )
          } else {
            eventsRef.current.onError('HLS akışı oynatılamadı. Yayın biçimi desteklenmiyor olabilir.')
          }
        })
      } else {
        video.src = source.url
        video.load()
      }

      if (video.readyState >= 1) fireReady()
    }

    void setup().catch((error: unknown) => {
      if (disposed) return
      eventsRef.current.onError(
        error instanceof Error ? error.message : 'Video kaynağı yüklenemedi.',
      )
    })

    return () => {
      disposed = true
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('progress', handleProgress)
      video.removeEventListener('durationchange', emitTime)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
      video.pause()
      hls?.destroy()
      hlsRef.current = null
      video.removeAttribute('src')
      video.load()
    }
  }, [source.provider, source.url])

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full bg-black object-contain"
      playsInline
      preload="auto"
      controls={false}
      crossOrigin={undefined}
    />
  )
})
