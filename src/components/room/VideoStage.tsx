import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MutableRefObject,
} from 'react'
import {
  AlertTriangle,
  Captions,
  ExternalLink,
  Loader2,
  MonitorPlay,
  Play,
  RefreshCw,
  Timer,
  WifiOff,
  X,
} from 'lucide-react'
import type { PlaybackState } from '@/types'
import type { PlaybackCommand } from '@/hooks/usePlayback'
import { computeExpectedTime } from '@/lib/playback'
import { PlayerRenderer } from '@/components/players/PlayerRenderer'
import type { PlayableSource, PlayerEvents, PlayerHandle } from '@/components/players/types'
import { PlayerControls, type SyncStatus } from '@/components/room/PlayerControls'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import { useRoomSignals } from '@/hooks/useRoomSignals'
import { formatClock } from '@/lib/format'
import { findActiveCue, parseSubtitles, type SubtitleCue } from '@/lib/subtitles'
import { parseVideoUrl } from '@/lib/video'
import { clamp, isEditableTarget, safeExternalUrl, safeLocalStorageGet, safeLocalStorageSet } from '@/lib/utils'

interface VideoStageProps {
  roomId: string
  uid: string
  playback: PlaybackState | null
  loading: boolean
  playbackError: string | null
  publish: (patch: PlaybackCommand) => Promise<string>
  serverOffset: number
  syncNonce: number
  isOnline: boolean
  lastLocalCommandIdRef: MutableRefObject<string | null>
  onRequestAddVideo: () => void
}

const VOLUME_KEY = 'birlikteizle:volume'
const MUTED_KEY = 'birlikteizle:muted'

/** Gömülü sayfa sayacı: iki taraf da aynı anda oynat düğmesine basabilsin diye. */
const COUNTDOWN_SECONDS = 3
const COUNTDOWN_MAX = 10

export function VideoStage({
  roomId,
  uid,
  playback,
  loading,
  playbackError,
  publish,
  serverOffset,
  syncNonce,
  isOnline,
  lastLocalCommandIdRef,
  onRequestAddVideo,
}: VideoStageProps) {
  const { pushToast } = useToast()
  const stageRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<PlayerHandle | null>(null)

  const [ready, setReady] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [previewTime, setPreviewTime] = useState<number | null>(null)
  const [adjusting, setAdjusting] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [volume, setVolume] = useState(() => {
    const stored = Number(safeLocalStorageGet(VOLUME_KEY) ?? '0.8')
    return clamp(Number.isFinite(stored) ? stored : 0.8, 0, 1)
  })
  const [muted, setMuted] = useState(() => safeLocalStorageGet(MUTED_KEY) === '1')
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([])
  const [subtitleName, setSubtitleName] = useState('')
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  const subtitleInputRef = useRef<HTMLInputElement>(null)

  const readyRef = useRef(false)
  const playbackRef = useRef<PlaybackState | null>(playback)
  playbackRef.current = playback
  const offsetRef = useRef(serverOffset)
  offsetRef.current = serverOffset
  const volumeRef = useRef(volume)
  volumeRef.current = volume
  const mutedRef = useRef(muted)
  mutedRef.current = muted

  const appliedCommandRef = useRef('')
  const needsApplyRef = useRef(true)
  const lastSyncNonceRef = useRef(syncNonce)
  const graceUntilRef = useRef(0)
  const adjustingTimerRef = useRef<number | null>(null)
  const autoplayTimerRef = useRef<number | null>(null)
  const countdownTimerRef = useRef<number | null>(null)
  const publishCommandRef = useRef<(patch: PlaybackCommand) => Promise<void>>(async () => undefined)

  const parsedSource = useMemo(
    () => (playback?.sourceUrl ? parseVideoUrl(playback.sourceUrl) : null),
    [playback?.sourceUrl],
  )

  const playable = useMemo<PlayableSource | null>(() => {
    if (!playback || playback.provider === 'none' || !playback.sourceUrl) return null
    if (!parsedSource || !parsedSource.ok) return null
    return {
      provider: parsedSource.source.provider,
      url: parsedSource.source.url,
      videoId: parsedSource.source.videoId,
      embedUrl: parsedSource.embedUrl,
      startAt: parsedSource.source.startAt,
    }
  }, [playback, parsedSource])

  const playableRef = useRef<PlayableSource | null>(playable)
  playableRef.current = playable

  /** Gömülü sayfa (iframe) kaynakları dışarıdan kontrol edilemez. */
  const isEmbed = playable?.provider === 'iframe'

  const sourceKey = playable ? `${playable.provider}:${playable.url}` : ''
  const sourceFailure = parsedSource && !parsedSource.ok ? parsedSource : null

  useEffect(() => {
    readyRef.current = false
    setReady(false)
    setPlayerError(null)
    setAutoplayBlocked(false)
    setDuration(0)
    setBuffered(0)
    setPreviewTime(null)
    setCurrentTime(playbackRef.current?.currentTime ?? 0)
    appliedCommandRef.current = ''
    needsApplyRef.current = true
    graceUntilRef.current = 0
    setSubtitleCues([])
    setSubtitleName('')
    setSubtitlesEnabled(false)
    if (autoplayTimerRef.current) window.clearTimeout(autoplayTimerRef.current)
  }, [sourceKey])

  useEffect(() => {
    safeLocalStorageSet(VOLUME_KEY, String(volume))
    safeLocalStorageSet(MUTED_KEY, muted ? '1' : '0')
    const player = playerRef.current
    if (!player || !readyRef.current) return
    player.setVolume(volume)
    player.setMuted(muted)
  }, [volume, muted, ready])

  const flashAdjusting = useCallback(() => {
    setAdjusting(true)
    if (adjustingTimerRef.current) window.clearTimeout(adjustingTimerRef.current)
    adjustingTimerRef.current = window.setTimeout(() => setAdjusting(false), 1600)
  }, [])

  const scheduleAutoplayCheck = useCallback(() => {
    if (autoplayTimerRef.current) window.clearTimeout(autoplayTimerRef.current)
    autoplayTimerRef.current = window.setTimeout(() => {
      const player = playerRef.current
      const state = playbackRef.current
      if (!player || !state || state.status !== 'playing') return
      if (player.isPaused() && !player.isBuffering()) setAutoplayBlocked(true)
    }, 1800)
  }, [])

  const applyPlayback = useCallback(
    async (state: PlaybackState, options?: { force?: boolean }) => {
      const player = playerRef.current
      const source = playableRef.current
      if (!player || !readyRef.current || !source) return
      if (source.provider === 'iframe') return
      if (state.sourceUrl !== source.url) return

      const expected = computeExpectedTime(state, offsetRef.current)
      const rate = clamp(state.playbackRate, 0.25, 4)

      if (Math.abs(player.getPlaybackRate() - rate) > 0.01) {
        player.setPlaybackRate(rate)
      }

      try {
        if (state.status === 'playing') {
          const tolerance = options?.force ? 0.5 : 1.15
          if (Math.abs(player.getCurrentTime() - expected) > tolerance) {
            player.seek(expected)
          }
          if (player.isPaused()) {
            await player.play()
          }
          setAutoplayBlocked(false)
          scheduleAutoplayCheck()
        } else if (state.status === 'paused') {
          player.pause()
          const tolerance = options?.force ? 0.35 : 0.7
          if (Math.abs(player.getCurrentTime() - expected) > tolerance) {
            player.seek(expected)
          }
          setAutoplayBlocked(false)
        } else {
          player.pause()
        }

        appliedCommandRef.current = state.commandId
        needsApplyRef.current = false
      } catch {
        setAutoplayBlocked(true)
        appliedCommandRef.current = state.commandId
      }
    },
    [scheduleAutoplayCheck],
  )

  const publishCommand = useCallback(
    async (patch: PlaybackCommand) => {
      if (!isOnline) {
        pushToast({
          kind: 'warning',
          title: 'Bağlantı yok',
          description: 'Kontroller bağlantı yeniden kurulunca etkinleşecek.',
        })
        return
      }

      graceUntilRef.current = Date.now() + 2200

      try {
        const commandId = await publish(patch)
        appliedCommandRef.current = commandId
      } catch {
        pushToast({
          kind: 'error',
          title: 'Senkronize edilemedi',
          description: 'Oynatma durumu yazılamadı. Bağlantı yeniden kurulunca oda durumu uygulanacak.',
        })
        const state = playbackRef.current
        if (state) void applyPlayback(state, { force: true })
      }
    },
    [applyPlayback, isOnline, publish, pushToast],
  )
  publishCommandRef.current = publishCommand

  const handleReady = useCallback(() => {
    readyRef.current = true
    setReady(true)
    const player = playerRef.current
    if (!player) return
    player.setVolume(volumeRef.current)
    player.setMuted(mutedRef.current)

    const state = playbackRef.current
    if (state) void applyPlayback(state, { force: true })
  }, [applyPlayback])

  const handleTimeUpdate = useCallback((time: number, total: number, loaded: number) => {
    setCurrentTime(time)
    if (Number.isFinite(total) && total > 0) setDuration(total)
    setBuffered(loaded)
  }, [])

  const handleEnded = useCallback(() => {
    const state = playbackRef.current
    if (!state || state.status !== 'playing') return
    const player = playerRef.current
    const endTime = player?.getDuration() || state.currentTime
    setCurrentTime(endTime)
    void publishCommandRef.current({
      status: 'paused',
      currentTime: endTime,
      playbackRate: state.playbackRate,
    })
  }, [])

  const handlePlayerError = useCallback((message: string) => {
    setPlayerError(message)
    setReady(false)
  }, [])

  const playerEvents = useMemo<PlayerEvents>(
    () => ({
      onReady: handleReady,
      onTimeUpdate: handleTimeUpdate,
      onEnded: handleEnded,
      onError: handlePlayerError,
    }),
    [handleReady, handleTimeUpdate, handleEnded, handlePlayerError],
  )

  // Uzak komutları uygula; kendi yazdığımız komutları tekrar uygulayıp döngü oluşturma.
  useEffect(() => {
    if (!ready || !playback || !playable || isEmbed) return

    const nonceChanged = lastSyncNonceRef.current !== syncNonce
    if (nonceChanged) lastSyncNonceRef.current = syncNonce

    const isLocal = lastLocalCommandIdRef.current === playback.commandId
    const alreadyApplied = appliedCommandRef.current === playback.commandId

    if (!nonceChanged && isLocal && !needsApplyRef.current) {
      appliedCommandRef.current = playback.commandId
      return
    }
    if (!nonceChanged && alreadyApplied && !needsApplyRef.current) return

    void applyPlayback(playback, {
      force: nonceChanged || needsApplyRef.current || !appliedCommandRef.current,
    })
  }, [ready, playback, playable, isEmbed, syncNonce, serverOffset, applyPlayback, lastLocalCommandIdRef])

  // Periyodik sürüklenme denetimi: küçük farklara dokunma, tolerans aşılınca hizala.
  useEffect(() => {
    if (!ready || !playback || !sourceKey || !isOnline || isEmbed) return

    const interval = window.setInterval(() => {
      const player = playerRef.current
      const state = playbackRef.current
      const source = playableRef.current
      if (!player || !state || !source || state.sourceUrl !== source.url) return
      if (document.visibilityState !== 'visible') return
      if (Date.now() < graceUntilRef.current) return
      if (player.isBuffering()) return

      const expected = computeExpectedTime(state, offsetRef.current)
      const rate = clamp(state.playbackRate, 0.25, 4)

      if (Math.abs(player.getPlaybackRate() - rate) > 0.02) {
        player.setPlaybackRate(rate)
      }

      const drift = player.getCurrentTime() - expected

      if (state.status === 'playing') {
        if (player.isPaused()) {
          void player.play().catch(() => setAutoplayBlocked(true))
        }
        if (Math.abs(drift) > 1.5) {
          player.seek(expected)
          flashAdjusting()
        }
      } else if (state.status === 'paused') {
        if (!player.isPaused()) player.pause()
        if (Math.abs(drift) > 0.75) {
          player.seek(expected)
          flashAdjusting()
        }
      }
    }, 3000)

    return () => window.clearInterval(interval)
  }, [ready, playback, sourceKey, isOnline, isEmbed, flashAdjusting])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible' || !readyRef.current) return
      const state = playbackRef.current
      if (state) void applyPlayback(state, { force: true })
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [applyPlayback])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const element = stageRef.current
      setIsFullscreen(
        Boolean(
          document.fullscreenElement &&
            element &&
            (document.fullscreenElement === element || element.contains(document.fullscreenElement)),
        ),
      )
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    return () => {
      if (adjustingTimerRef.current) window.clearTimeout(adjustingTimerRef.current)
      if (autoplayTimerRef.current) window.clearTimeout(autoplayTimerRef.current)
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current)
    }
  }, [])

  const canControl = isOnline && Boolean(playable) && ready && !playerError && !sourceFailure && !isEmbed
  const activeCue = useMemo(
    () => (subtitlesEnabled ? findActiveCue(subtitleCues, currentTime) : null),
    [subtitlesEnabled, subtitleCues, currentTime],
  )

  const handleTogglePlay = useCallback(() => {
    const state = playbackRef.current
    const player = playerRef.current
    if (!state || !player || !playableRef.current || !isOnline) return

    setPreviewTime(null)

    if (state.status === 'playing') {
      player.pause()
      setAutoplayBlocked(false)
      void publishCommandRef.current({
        status: 'paused',
        currentTime: player.getCurrentTime(),
        playbackRate: state.playbackRate,
      })
      return
    }

    setAutoplayBlocked(false)
    const total = player.getDuration()
    let start = player.getCurrentTime()
    if (total > 0 && start >= total - 0.3) {
      player.seek(0)
      start = 0
    }

    player.play().catch(() => setAutoplayBlocked(true))
    void publishCommandRef.current({
      status: 'playing',
      currentTime: start,
      playbackRate: state.playbackRate,
    })
  }, [isOnline])

  const handleSeek = useCallback(
    (target: number) => {
      const state = playbackRef.current
      const player = playerRef.current
      if (!state || !player || !isOnline) return

      const total = player.getDuration()
      const next = clamp(target, 0, total > 0 ? total : target)
      player.seek(next)
      setCurrentTime(next)
      setPreviewTime(null)

      const status = state.status === 'playing' ? 'playing' : state.status === 'idle' ? 'paused' : state.status
      if (state.status === 'playing') {
        player.play().catch(() => setAutoplayBlocked(true))
      }

      void publishCommandRef.current({
        status,
        currentTime: next,
        playbackRate: state.playbackRate,
      })
    },
    [isOnline],
  )

  const handleSkip = useCallback(
    (seconds: number) => {
      const player = playerRef.current
      if (!player) return
      handleSeek(player.getCurrentTime() + seconds)
    },
    [handleSeek],
  )

  const handleRateChange = useCallback(
    (rate: number) => {
      const state = playbackRef.current
      const player = playerRef.current
      if (!state || !player || !isOnline) return
      player.setPlaybackRate(rate)
      void publishCommandRef.current({
        status: state.status,
        currentTime: player.getCurrentTime(),
        playbackRate: rate,
      })
    },
    [isOnline],
  )

  const handleVolumeChange = useCallback((next: number) => {
    const sanitized = clamp(next, 0, 1)
    setVolume(sanitized)
    if (sanitized > 0) setMuted(false)
    playerRef.current?.setVolume(sanitized)
  }, [])

  const handleToggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current
      playerRef.current?.setMuted(next)
      if (!next) playerRef.current?.setVolume(volumeRef.current)
      return next
    })
  }, [])

  const handleSubtitleFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return

      if (file.size > 2_000_000) {
        pushToast({
          kind: 'warning',
          title: 'Altyazı dosyası çok büyük',
          description: 'En fazla 2 MB boyutunda bir .vtt veya .srt dosyası seçin.',
        })
        return
      }

      try {
        const content = await file.text()
        const cues = parseSubtitles(content)
        if (cues.length === 0) {
          pushToast({
            kind: 'error',
            title: 'Altyazı okunamadı',
            description: 'Dosyada geçerli bir WebVTT veya SRT zaman damgası bulunamadı.',
          })
          return
        }

        setSubtitleCues(cues)
        setSubtitleName(file.name)
        setSubtitlesEnabled(true)
        pushToast({
          kind: 'success',
          title: 'Altyazı yüklendi',
          description: `${cues.length} satır yüklendi. Altyazı yalnızca bu cihazda gösterilir.`,
        })
      } catch {
        pushToast({
          kind: 'error',
          title: 'Altyazı dosyası açılamadı',
          description: 'Dosya okunamadı. UTF-8 kodlamalı bir .vtt veya .srt dosyası deneyin.',
        })
      }
    },
    [pushToast],
  )

  const handleSubtitleClick = useCallback(() => {
    if (subtitleCues.length > 0) {
      setSubtitlesEnabled((current) => !current)
      return
    }
    subtitleInputRef.current?.click()
  }, [subtitleCues.length])

  const { on: onSignal, send: sendSignal } = useRoomSignals(roomId, uid)

  const runCountdown = useCallback(
    (seconds: number) => {
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current)
      let remaining = seconds
      setCountdown(remaining)
      countdownTimerRef.current = window.setInterval(() => {
        remaining -= 1
        if (remaining <= 0) {
          if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current)
          countdownTimerRef.current = null
          setCountdown(null)
          pushToast({
            kind: 'success',
            title: 'Şimdi başlat!',
            description: 'İkiniz de gömülü sayfada oynat düğmesine basın.',
          })
          return
        }
        setCountdown(remaining)
      }, 1000)
    },
    [pushToast],
  )

  useEffect(() => {
    return onSignal('countdown', (signal) => {
      const data = signal.data as { seconds?: number } | null
      const raw = Math.round(Number(data?.seconds ?? COUNTDOWN_SECONDS))
      const seconds = Number.isFinite(raw) ? raw : COUNTDOWN_SECONDS
      runCountdown(Math.min(COUNTDOWN_MAX, Math.max(1, seconds)))
    })
  }, [onSignal, runCountdown])

  const handleCountdown = useCallback(() => {
    void sendSignal('countdown', { seconds: COUNTDOWN_SECONDS })
    runCountdown(COUNTDOWN_SECONDS)
  }, [runCountdown, sendSignal])

  const handleRemoveSubtitles = useCallback(() => {
    setSubtitleCues([])
    setSubtitleName('')
    setSubtitlesEnabled(false)
    pushToast({ kind: 'info', title: 'Altyazı kaldırıldı' })
  }, [pushToast])

  const handleToggleFullscreen = useCallback(async () => {
    const element = stageRef.current
    if (!element) return

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }
      if (element.requestFullscreen) {
        await element.requestFullscreen()
        return
      }
      const video = element.querySelector('video') as
        | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
        | null
      video?.webkitEnterFullscreen?.()
    } catch {
      pushToast({ kind: 'warning', title: 'Tam ekran açılamadı' })
    }
  }, [pushToast])

  const handleUnblock = useCallback(() => {
    const state = playbackRef.current
    if (!state) return
    setAutoplayBlocked(false)
    void applyPlayback(state, { force: true })
  }, [applyPlayback])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const active = document.activeElement
      if (active instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(active.tagName)) {
        return
      }
      if (!canControl) return

      if (event.code === 'Space') {
        event.preventDefault()
        handleTogglePlay()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        handleSkip(-5)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleSkip(5)
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        void handleToggleFullscreen()
      } else if (event.key.toLowerCase() === 'm') {
        event.preventDefault()
        setMuted((current) => !current)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canControl, handleTogglePlay, handleSkip, handleToggleFullscreen])

  const syncStatus: SyncStatus = !isOnline
    ? 'offline'
    : loading || (playable && !ready)
      ? 'loading'
      : adjusting
        ? 'adjusting'
        : 'synced'

  const fatalError = playbackError ?? sourceFailure?.reason ?? playerError
  const isLoadingPlayer = Boolean(playable) && !ready && !fatalError
  const displayTime = previewTime ?? currentTime
  const externalSourceUrl = playable ? safeExternalUrl(playable.url) : null

  return (
    <section className="min-w-0">
      <div
        ref={stageRef}
        className="player-stage player-surface relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-panel"
      >
        <div className="player-frame relative aspect-video w-full">
          {playable && !fatalError ? (
            <PlayerRenderer source={playable} playerRef={playerRef} events={playerEvents} />
          ) : null}

          {playable && !fatalError && canControl ? (
            <button
              type="button"
              onClick={handleTogglePlay}
              className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none"
              aria-label={playback?.status === 'playing' ? 'Videoyu duraklat' : 'Videoyu oynat'}
            />
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between bg-gradient-to-b from-black/70 to-transparent p-3">
            {playable ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-medium text-white/80 backdrop-blur">
                <MonitorPlay className="h-3 w-3" />
                {parsedSource?.ok ? parsedSource.providerLabel : 'Video'}
              </span>
            ) : (
              <span />
            )}

            {!isOnline && playable ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/20 bg-rose-500/20 px-2.5 py-1 text-[10px] font-medium text-rose-200 backdrop-blur">
                <WifiOff className="h-3 w-3" />
                Çevrimdışı
              </span>
            ) : null}
          </div>

          {!playback && loading ? (
            <div className="absolute inset-0 grid place-items-center bg-night-900">
              <div className="flex flex-col items-center gap-2 text-zinc-400">
                <Loader2 className="h-6 w-6 animate-spin text-brand-300" />
                <p className="text-xs">Oda durumu yükleniyor…</p>
              </div>
            </div>
          ) : null}

          {!playable && !fatalError && playback ? (
            <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,.16),transparent_55%),radial-gradient(circle_at_80%_85%,rgba(34,211,238,.08),transparent_55%)] p-6 text-center">
              <div className="max-w-xs">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-brand-300 shadow-inner-line">
                  <Play className="ml-1 h-6 w-6 fill-current" />
                </span>
                <h2 className="mt-4 font-display text-lg font-semibold text-zinc-100">
                  Henüz video eklenmedi
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
                  Aşağıdaki alana bir YouTube, Vimeo, doğrudan video (.mp4/.m3u8) ya da web sayfası
                  bağlantısı yapıştır. Kaynak iki tarafta da aynı anda açılır.
                </p>
                <Button variant="soft" size="sm" className="mt-4" onClick={onRequestAddVideo}>
                  <Play className="h-3.5 w-3.5" />
                  Video bağlantısı ekle
                </Button>
              </div>
            </div>
          ) : null}

          {isLoadingPlayer ? (
            <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-2.5 text-zinc-300">
                <Loader2 className="h-7 w-7 animate-spin text-brand-300" />
                <p className="text-xs">Oynatıcı hazırlanıyor…</p>
              </div>
            </div>
          ) : null}

          {fatalError ? (
            <div className="absolute inset-0 z-20 grid place-items-center bg-night-950/92 p-6">
              <div className="max-w-sm text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-rose-400/20 bg-rose-500/10 text-rose-300">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <h2 className="mt-3.5 font-display text-base font-semibold text-zinc-100">
                  Video oynatılamıyor
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{fatalError}</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {externalSourceUrl ? (
                    <a
                      href={externalSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.1]"
                    >
                      Harici sekmede aç
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  <Button variant="soft" size="sm" onClick={onRequestAddVideo}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Kaynağı değiştir
                  </Button>
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
                  Harici oynatıcıdaki video senkronize edilemez.
                </p>
              </div>
            </div>
          ) : null}

          {autoplayBlocked && ready && !fatalError ? (
            <div className="absolute inset-0 z-20 grid place-items-center bg-black/65 p-6 backdrop-blur-[2px]">
              <button
                type="button"
                onClick={handleUnblock}
                className="group max-w-xs rounded-2xl border border-white/10 bg-night-900/80 p-5 text-center transition hover:border-brand-400/30 hover:bg-night-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-night-950 transition group-hover:scale-105">
                  <Play className="ml-0.5 h-5 w-5 fill-current" />
                </span>
                <span className="mt-3 block text-sm font-semibold text-zinc-100">
                  Senkronize et ve oynat
                </span>
                <span className="mt-1 block text-[11px] leading-relaxed text-zinc-400">
                  Tarayıcı otomatik oynatmayı engelledi. Devam etmek için dokun.
                </span>
              </button>
            </div>
          ) : null}

          {activeCue ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-[72px] z-20 flex justify-center px-3 sm:bottom-[82px]">
              <span className="max-w-[92%] whitespace-pre-line rounded-lg border border-white/10 bg-black/80 px-3 py-1.5 text-center text-[12px] font-medium leading-snug text-white shadow-[0_4px_24px_rgba(0,0,0,.6)] sm:text-[14px]">
                {activeCue.text}
              </span>
            </div>
          ) : null}

          {countdown !== null ? (
            <div className="absolute inset-0 z-40 grid place-items-center bg-black/70 backdrop-blur-[2px]">
              <div className="text-center">
                <p
                  key={countdown}
                  className="font-display text-6xl font-bold tabular-nums text-white drop-shadow-[0_2px_20px_rgba(139,92,246,.6)] sm:text-7xl"
                >
                  {countdown}
                </p>
                <p className="mt-2 text-[11px] text-zinc-300">
                  Hazır ol — sayaç bitince oynat düğmesine bas
                </p>
              </div>
            </div>
          ) : null}

          {isEmbed && !fatalError ? (
            <div className="absolute inset-x-0 bottom-0 z-30 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2.5 pb-2.5 pt-10 sm:px-4 sm:pb-3">
              <p className="max-w-[60%] text-[10px] leading-relaxed text-zinc-400">
                Gömülü sayfa dışarıdan kontrol edilemez. Aynı anda başlamak için sayacı kullanın; site
                gömülmeyi engelliyorsa ekran paylaşımı moduna geçin.
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="soft"
                  size="sm"
                  disabled={!isOnline}
                  onClick={() => handleCountdown()}
                >
                  <Timer className="h-3.5 w-3.5" />
                  3-2-1 başlat
                </Button>
                {externalSourceUrl ? (
                  <a
                    href={externalSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/[0.1]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Harici sekme
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          {playable && ready && !fatalError && !isEmbed ? (
            <PlayerControls
              playing={playback?.status === 'playing'}
              currentTime={displayTime}
              duration={duration}
              buffered={buffered}
              playbackRate={playback?.playbackRate ?? 1}
              volume={volume}
              muted={muted}
              isFullscreen={isFullscreen}
              canControl={canControl}
              syncStatus={syncStatus}
              subtitlesAvailable={subtitleCues.length > 0}
              subtitlesEnabled={subtitlesEnabled}
              onSubtitleClick={handleSubtitleClick}
              onTogglePlay={handleTogglePlay}
              onSeekPreview={(time) => setPreviewTime(time)}
              onSeek={handleSeek}
              onSkip={handleSkip}
              onRateChange={handleRateChange}
              onVolumeChange={handleVolumeChange}
              onToggleMute={handleToggleMute}
              onToggleFullscreen={() => void handleToggleFullscreen()}
            />
          ) : null}
        </div>
      </div>

      <input
        ref={subtitleInputRef}
        type="file"
        accept=".vtt,.srt,text/vtt,text/plain"
        onChange={(event) => void handleSubtitleFile(event)}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-0.5">
        <p className="text-[10px] text-zinc-600">
          {isEmbed ? (
            <>Gömülü sayfa: oynatma kontrolü sitede kalır · </>
          ) : (
            <span className="hidden sm:inline">Boşluk: oynat/duraklat · ←/→: 5 sn · F: tam ekran · M: ses · </span>
          )}
          Ses, tam ekran ve altyazı yalnızca bu cihazda değişir.
        </p>

        {subtitleName ? (
          <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-zinc-500">
            <Captions className="h-3 w-3 shrink-0 text-brand-300" />
            <span className="max-w-[180px] truncate" title={subtitleName}>
              {subtitleName}
            </span>
            <button
              type="button"
              onClick={() => setSubtitlesEnabled((current) => !current)}
              className="rounded px-1 py-0.5 font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400"
            >
              {subtitlesEnabled ? 'Gizle' : 'Göster'}
            </button>
            <button
              type="button"
              onClick={handleRemoveSubtitles}
              aria-label="Altyazıyı kaldır"
              className="grid h-5 w-5 place-items-center rounded text-zinc-600 transition hover:bg-white/[0.06] hover:text-rose-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => subtitleInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[10px] text-zinc-600 transition hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400"
          >
            <Captions className="h-3 w-3" />
            Yerel altyazı yükle (.vtt / .srt)
          </button>
        )}
      </div>

      {previewTime !== null && duration > 0 ? (
        <p className="mt-1.5 text-right text-[10px] text-zinc-500">
          {formatClock(previewTime)} konumuna sarılacak
        </p>
      ) : null}

      {parsedSource?.ok && parsedSource.note ? (
        <p className="mt-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[10px] leading-relaxed text-zinc-500">
          {parsedSource.note}
        </p>
      ) : null}
    </section>
  )
}
