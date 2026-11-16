import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react'
import type { PlayerEvents, PlayerHandle, PlayerProps } from '@/components/players/types'

/**
 * Gömülü sayfa (iframe) oynatıcısı.
 *
 * Bu kaynaklar tarayıcı güvenliği gereği kod ile kontrol edilemez: site başka bir
 * pencereden oynat/duraklat komutu kabul etmez. Bu yüzden `PlayerHandle` yalnızca
 * "hazır" bilgisini verir; taşıma kontrolleri arayüzde kapatılır. Aynı anda
 * başlatmak için odadaki 3-2-1 sayacı kullanılır.
 */
export const IframePlayer = forwardRef<PlayerHandle, PlayerProps>(function IframePlayer(
  { source, events },
  ref,
) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const eventsRef = useRef<PlayerEvents>(events)
  eventsRef.current = events

  const [loaded, setLoaded] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  // Çoğu site gömülmeyi reddettiğinde iframe boş kalır ve hata olayı vermez.
  // Bu yüzden belirli bir süre sonra kullanıcıya ipucu gösteririz.
  useEffect(() => {
    setLoaded(false)
    setTimedOut(false)
    const timer = window.setTimeout(() => setTimedOut(true), 6000)
    return () => window.clearTimeout(timer)
  }, [source.embedUrl])

  const handleLoad = useCallback(() => {
    setLoaded(true)
    setTimedOut(false)
    eventsRef.current.onReady()
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      // Gömülü sayfayı dışarıdan yönetmek mümkün değildir; komutlar sessizce yok sayılır.
      play: async () => undefined,
      pause: () => undefined,
      seek: () => undefined,
      setPlaybackRate: () => undefined,
      getCurrentTime: () => 0,
      getDuration: () => 0,
      getPlaybackRate: () => 1,
      isPaused: () => false,
      isBuffering: () => !loaded,
      setVolume: () => undefined,
      setMuted: () => undefined,
    }),
    [loaded],
  )

  return (
    <div className="absolute inset-0">
      <iframe
        ref={frameRef}
        src={source.embedUrl}
        title="Gömülü sayfa"
        className="h-full w-full border-0 bg-black"
        onLoad={handleLoad}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-downloads"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />

      {!loaded ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-night-950/85">
          <div className="flex flex-col items-center gap-2.5 text-zinc-300">
            {timedOut ? (
              <>
                <AlertTriangle className="h-6 w-6 text-amber-300" />
                <p className="max-w-xs text-center text-[11px] leading-relaxed text-amber-200/90">
                  Bu site gömülü oynatmayı engelliyor olabilir. İçerik görünmüyorsa bağlantıyı
                  harici sekmede aç ve ekran paylaşımı modunu kullan.
                </p>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.07] px-2.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/[0.12]"
                >
                  Harici sekmede aç
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </>
            ) : (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-brand-300" />
                <p className="text-xs">Gömülü sayfa yükleniyor...</p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
})
