import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clapperboard,
  ExternalLink,
  Link2,
  Loader2,
  Play,
  Trash2,
  WifiOff,
} from 'lucide-react'
import type { PlaybackState, VideoProvider } from '@/types'
import type { PlaybackCommand } from '@/hooks/usePlayback'
import { useToast } from '@/context/ToastContext'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { providerDisplayName, parseVideoUrl, type VideoParseFailure } from '@/lib/video'
import { safeExternalUrl } from '@/lib/utils'

interface SourceBarProps {
  playback: PlaybackState | null
  publish: (patch: PlaybackCommand) => Promise<string>
  isOnline: boolean
  /** Artınca giriş alanına odaklanılır (video yoksa "video ekle" çağrısı). */
  focusToken: number
}

function ProviderIcon({ provider }: { provider: VideoProvider }) {
  return provider === 'none' ? (
    <Clapperboard className="h-3.5 w-3.5" />
  ) : (
    <Play className="h-3.5 w-3.5" />
  )
}

export function SourceBar({ playback, publish, isOnline, focusToken }: SourceBarProps) {
  const { pushToast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const [value, setValue] = useState('')
  const [failure, setFailure] = useState<VideoParseFailure | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    if (focusToken <= 0) return
    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
    return () => window.clearTimeout(timer)
  }, [focusToken])

  useEffect(() => {
    setConfirmRemove(false)
  }, [playback?.sourceUrl])

  const parsedInput = useMemo(() => {
    const trimmed = value.trim()
    return trimmed ? parseVideoUrl(trimmed) : null
  }, [value])

  const liveFailure = parsedInput && !parsedInput.ok ? parsedInput : null
  const currentSource = useMemo(
    () => (playback?.sourceUrl ? parseVideoUrl(playback.sourceUrl) : null),
    [playback?.sourceUrl],
  )
  const currentExternal = currentSource?.ok ? safeExternalUrl(currentSource.source.url) : null
  const hasVideo = Boolean(playback && playback.provider !== 'none' && playback.sourceUrl)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return

    if (!isOnline) {
      pushToast({
        kind: 'warning',
        title: 'Bağlantı yok',
        description: 'Video değiştirmek için bağlantının yeniden kurulması gerekiyor.',
      })
      return
    }

    const parsed = parseVideoUrl(value)
    if (!parsed.ok) {
      setFailure(parsed)
      return
    }

    setFailure(null)
    setSubmitting(true)
    try {
      await publish({
        status: 'paused',
        currentTime: parsed.source.startAt,
        playbackRate: 1,
        sourceUrl: parsed.source.url,
        provider: parsed.source.provider,
        videoId: parsed.source.videoId,
      })
      setValue('')
      pushToast({
        kind: 'success',
        title: 'Video değiştirildi',
        description: `${parsed.providerLabel} iki tarafta da duraklatılmış olarak hazır.`,
      })
    } catch {
      pushToast({
        kind: 'error',
        title: 'Video değiştirilemedi',
        description: 'Oynatma kaynağı yazılamadı. Bağlantınızı kontrol edip tekrar deneyin.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async () => {
    if (!isOnline || submitting) return
    if (!confirmRemove) {
      setConfirmRemove(true)
      return
    }

    setSubmitting(true)
    try {
      await publish({
        status: 'idle',
        currentTime: 0,
        playbackRate: 1,
        sourceUrl: '',
        provider: 'none',
        videoId: '',
      })
      setConfirmRemove(false)
      pushToast({ kind: 'info', title: 'Video odadan kaldırıldı' })
    } catch {
      pushToast({ kind: 'error', title: 'Video kaldırılamadı' })
    } finally {
      setSubmitting(false)
    }
  }

  const shownFailure = failure ?? liveFailure

  return (
    <section className="panel-soft p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.04] text-brand-300">
            <ProviderIcon provider={playback?.provider ?? 'none'} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Oynatılan kaynak
            </p>
            <p className="truncate text-[12.5px] font-medium text-zinc-200">
              {hasVideo
                ? currentSource?.ok
                  ? `${currentSource.providerLabel} · ${currentSource.title}`
                  : providerDisplayName(playback?.provider ?? 'none')
                : 'Henüz video eklenmedi'}
            </p>
          </div>
        </div>

        {hasVideo ? (
          <div className="flex items-center gap-1.5">
            {currentExternal ? (
              <a
                href={currentExternal}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-medium text-zinc-300 transition hover:bg-white/[0.08]"
              >
                Aç
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
            <Button
              variant={confirmRemove ? 'danger' : 'ghost'}
              size="icon-sm"
              onClick={() => void handleRemove()}
              disabled={!isOnline || submitting}
              aria-label={confirmRemove ? 'Kaldırmayı onayla' : 'Videoyu kaldır'}
              title={confirmRemove ? 'Onaylamak için tekrar tıkla' : 'Videoyu odadan kaldır'}
            >
              {submitting && confirmRemove ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
            {confirmRemove ? (
              <button
                type="button"
                onClick={() => setConfirmRemove(false)}
                className="text-[10px] font-medium text-zinc-500 underline decoration-white/20 underline-offset-2 transition hover:text-zinc-300"
              >
                Vazgeç
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            ref={inputRef}
            id="change-video-url"
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setFailure(null)
            }}
            leadingIcon={<Link2 className="h-4 w-4" />}
            placeholder="YouTube, Vimeo, .mp4 / .m3u8 veya web sayfası bağlantısı yapıştır"
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
            invalid={Boolean(shownFailure)}
            aria-label="Yeni video bağlantısı"
            aria-describedby="source-bar-help"
            containerClassName="flex-1"
            disabled={!isOnline}
          />
          <Button
            type="submit"
            variant={hasVideo ? 'secondary' : 'primary'}
            loading={submitting}
            disabled={!isOnline || !value.trim()}
            className="h-10 shrink-0"
          >
            {!submitting ? <Play className="h-3.5 w-3.5 fill-current" /> : null}
            {hasVideo ? 'Kaynağı değiştir' : 'Videoyu aç'}
          </Button>
        </div>
      </form>

      <div id="source-bar-help" className="mt-2 min-h-[16px] text-[10.5px] leading-relaxed">
        {!isOnline ? (
          <span className="inline-flex items-center gap-1.5 text-amber-300/80">
            <WifiOff className="h-3 w-3" />
            Çevrimdışısın. Video değiştirme bağlantı gelince etkinleşir.
          </span>
        ) : shownFailure ? (
          <span role="alert" className="inline-flex flex-wrap items-start gap-1.5 text-amber-200/90">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              {shownFailure.reason}{' '}
              {shownFailure.externalUrl && safeExternalUrl(shownFailure.externalUrl) ? (
                <a
                  href={safeExternalUrl(shownFailure.externalUrl) ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-semibold text-amber-300 underline decoration-amber-400/40 underline-offset-2 hover:text-amber-200"
                >
                  Harici sekmede aç
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              ) : null}
            </span>
          </span>
        ) : parsedInput?.ok ? (
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-emerald-300/90">
            <CheckCircle2 className="h-3 w-3" />
            {parsedInput.providerLabel} algılandı
            <span className="text-zinc-500">{parsedInput.title}</span>
            {parsedInput.source.startAt > 0 ? (
              <span className="text-zinc-500">· {parsedInput.source.startAt}. saniyeden başlar</span>
            ) : null}
            {parsedInput.note ? (
              <span className="w-full text-[10px] text-amber-200/80">{parsedInput.note}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-zinc-600">
            Yeni kaynak her iki tarafta açılır. YouTube/Vimeo ve video dosyaları senkron kontrol edilir;
            diğer web sayfaları gömülü açılır ve site izin veriyorsa senkron izlenir. DRM korumalı
            servisler (Netflix vb.) için ekran paylaşımı modunu kullan.
          </span>
        )}
      </div>
    </section>
  )
}
