import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Loader2,
  Maximize2,
  Minimize2,
  MonitorUp,
  PhoneOff,
  RefreshCcw,
  Smartphone,
  Volume2,
  VolumeX,
  Video,
  Mic,
  MicOff,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastContext'
import { useScreenShare } from '@/hooks/useScreenShare'
import type { BroadcastKind } from '@/hooks/screenShareTypes'
import { isSecure } from '@/lib/mediaCapture'
import { cn } from '@/lib/utils'

interface ScreenSharePanelProps {
  roomId: string
  uid: string
  displayName: string
  partnerName: string | null
  isOnline: boolean
}

/**
 * Yayın modu: "her siteden birlikte izleme".
 *
 * Masaüstünde ekran/sekme paylaşılır. Telefonlarda tarayıcılar ekranı
 * paylaşmaya izin vermediği için kamera yayını sunulur (telefonu ekrana çevir).
 */
export function ScreenSharePanel({
  roomId,
  uid,
  displayName,
  partnerName,
  isOnline,
}: ScreenSharePanelProps) {
  const { pushToast } = useToast()
  const {
    error,
    sharerName,
    localStream,
    remoteStream,
    startSharing,
    stopSharing,
    isSharing,
    isWatching,
    kind,
    canShareScreen,
    canShareCamera,
    switchCamera,
    micEnabled,
    toggleMic,
  } = useScreenShare(roomId, uid, displayName)

  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(false)
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [starting, setStarting] = useState(false)

  const stream = isWatching ? remoteStream : localStream
  const active = isSharing || isWatching
  const isCamera = kind === 'camera'

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (video.srcObject !== stream) video.srcObject = stream ?? null
  }, [stream])

  // Uzak akış geldiğinde sesli otomatik oynatma tarayıcı tarafından engellenebilir.
  useEffect(() => {
    if (!isWatching || !remoteStream) return
    const video = videoRef.current
    if (!video) return

    let cancelled = false
    video.muted = muted
    const attempt = video.play()
    if (attempt) {
      attempt
        .then(() => {
          if (!cancelled) setNeedsAudioUnlock(false)
        })
        .catch(() => {
          if (cancelled) return
          video.muted = true
          setMuted(true)
          setNeedsAudioUnlock(true)
          void video.play().catch(() => undefined)
        })
    }
    return () => {
      cancelled = true
    }
  }, [isWatching, remoteStream, muted])

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

  const handleStart = useCallback(
    async (broadcastKind: BroadcastKind) => {
      setStarting(true)
      pushToast({
        kind: 'info',
        title: broadcastKind === 'screen' ? 'Kaynak seç' : 'Kamera izni',
        description:
          broadcastKind === 'screen'
            ? 'Açılan pencerede filmi oynatan sekmeyi seç. "Sekme paylaşımı" seçersen ses de gelir.'
            : 'Kamera ve mikrofon izni ver. Telefonu ekrana/TV\'ye çevirip yayın açabilirsin.',
      })
      try {
        await startSharing(broadcastKind)
      } finally {
        setStarting(false)
      }
    },
    [pushToast, startSharing],
  )

  const handleToggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current
      const video = videoRef.current
      if (video) video.muted = next
      return next
    })
  }, [])

  const handleToggleFullscreen = useCallback(async () => {
    const element = stageRef.current
    if (!element) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await element.requestFullscreen()
    } catch {
      pushToast({ kind: 'warning', title: 'Tam ekran açılamadı' })
    }
  }, [pushToast])

  if (!active) {
    const insecure = !isSecure()

    return (
      <section className="panel mb-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <MonitorUp className="h-4 w-4 text-brand-300" />
              Yayın açarak birlikte izle
            </h2>
            <p className="mt-1.5 max-w-xl text-[11px] leading-relaxed text-zinc-500">
              Netflix, Disney+ ya da herhangi bir film sitesi güvenlik nedeniyle gömülü oynatılamaz.
              Bu modda filmi kendi tarafında açıp yayınlarsın; diğerleri sesli-görüntülü izler ve
              sohbet açık kalır.
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-zinc-500">
              <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />
              <span>
                {canShareScreen
                  ? 'Telefonda kullanacaksan "Kamera yayını" seç: telefon tarayıcıları ekran paylaşımına izin vermez, ama telefonu ekrana çevirip yayın açabilirsin.'
                  : 'Telefon tarayıcıları ekran paylaşımını desteklemez. Kamera yayını ile telefonunu ekrana/TV\'ye çevirip yayın açabilirsin.'}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canShareScreen ? (
              <Button
                variant="primary"
                size="sm"
                loading={starting}
                disabled={!isOnline || starting}
                onClick={() => void handleStart('screen')}
              >
                {!starting ? <MonitorUp className="h-3.5 w-3.5" /> : null}
                Ekran/sekme paylaş
              </Button>
            ) : null}

            {canShareCamera ? (
              <Button
                variant={canShareScreen ? 'secondary' : 'primary'}
                size="sm"
                disabled={!isOnline || starting}
                onClick={() => void handleStart('camera')}
              >
                <Video className="h-3.5 w-3.5" />
                Kamera yayını
              </Button>
            ) : null}
          </div>
        </div>

        {!canShareScreen && !canShareCamera ? (
          <p className="mt-3 rounded-lg border border-amber-400/15 bg-amber-400/[0.06] px-2.5 py-2 text-[11px] leading-relaxed text-amber-200/90">
            Bu tarayıcı ne ekran paylaşımını ne de kamera yayınını destekliyor. Güncel bir Chrome,
            Edge veya Safari kullanmayı dene.
          </p>
        ) : null}

        {insecure ? (
          <p className="mt-3 rounded-lg border border-amber-400/15 bg-amber-400/[0.06] px-2.5 py-2 text-[11px] leading-relaxed text-amber-200/90">
            Yayın için güvenli bağlantı (https) gerekir. Adresi <code>https://</code> ile açtığından
            emin ol.
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-lg border border-amber-400/15 bg-amber-400/[0.06] px-2.5 py-2 text-[11px] leading-relaxed text-amber-200/90">
            {error}
          </p>
        ) : null}
      </section>
    )
  }

  return (
    <section className="panel mb-3 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2 sm:px-4">
        <p className="flex min-w-0 items-center gap-2 text-[11px] font-medium">
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              isSharing ? 'bg-brand-400' : 'bg-emerald-400 animate-pulse',
            )}
          />
          <span className="truncate text-zinc-300">
            {isSharing
              ? isCamera
                ? 'Kamera yayını yapıyorsun — diğerleri sesli-görüntülü izliyor'
                : 'Ekranını paylaşıyorsun — diğerleri sesli-görüntülü izliyor'
              : `${sharerName ?? 'Katılımcı'} ${isCamera ? 'kamera yayını' : 'ekranını'} paylaşıyor`}
          </span>
        </p>

        <div className="flex items-center gap-1.5">
          {isSharing && isCamera ? (
            <>
              <button
                type="button"
                onClick={toggleMic}
                aria-label={micEnabled ? 'Mikrofonu kapat' : 'Mikrofonu aç'}
                title={micEnabled ? 'Mikrofonu kapat' : 'Mikrofonu aç'}
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                  micEnabled ? 'text-zinc-300 hover:bg-white/10 hover:text-white' : 'bg-rose-500/20 text-rose-300',
                )}
              >
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => void switchCamera()}
                aria-label="Kamerayı çevir"
                title="Ön/arka kamerayı değiştir"
                className="grid h-8 w-8 place-items-center rounded-lg text-zinc-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
            </>
          ) : null}

          {isWatching ? (
            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}
              title={muted ? 'Sesi aç' : 'Sesi kapat'}
              className="grid h-8 w-8 place-items-center rounded-lg text-zinc-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void handleToggleFullscreen()}
            aria-label={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
            title={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {isSharing ? (
            <Button variant="ghost" size="sm" onClick={stopSharing}>
              <PhoneOff className="h-3.5 w-3.5" />
              Yayını durdur
            </Button>
          ) : null}
        </div>
      </div>

      <div ref={stageRef} className="relative aspect-video w-full bg-black">
        <video
          ref={videoRef}
          className={cn('h-full w-full', isCamera && isSharing && 'object-cover')}
          autoPlay
          playsInline
          muted={isSharing || muted}
        />

        {isWatching && !remoteStream ? (
          <div className="absolute inset-0 grid place-items-center bg-night-950/85">
            <div className="flex flex-col items-center gap-2.5 text-zinc-300">
              <Loader2 className="h-6 w-6 animate-spin text-brand-300" />
              <p className="text-xs">Görüntü bekleniyor...</p>
            </div>
          </div>
        ) : null}

        {isWatching && needsAudioUnlock && remoteStream ? (
          <button
            type="button"
            onClick={() => {
              setMuted(false)
              setNeedsAudioUnlock(false)
              const video = videoRef.current
              if (video) {
                video.muted = false
                void video.play().catch(() => undefined)
              }
            }}
            className="absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3.5 py-2 text-[11px] font-medium text-white backdrop-blur transition hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Sesi aç
          </button>
        ) : null}
      </div>

      <p className="px-3 py-2 text-[10px] leading-relaxed text-zinc-600 sm:px-4">
        {isSharing
          ? isCamera
            ? 'Mikrofon düğmesiyle ortam sesini kapatabilir, kamerayı ön/arka olarak değiştirebilirsin.'
            : 'Ses, paylaştığın sekmenin sesidir. Tarayıcının kendi "Paylaşımı durdur" düğmesini de kullanabilirsin.'
          : partnerName
            ? 'Görüntü doğrudan paylaşan cihazdan gelir; sunucudan geçmez.'
            : 'Görüntü doğrudan paylaşan cihazdan gelir.'}
      </p>
    </section>
  )
}
