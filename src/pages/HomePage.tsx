import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  AppWindow,
  CheckCircle2,
  Clapperboard,
  ExternalLink,
  Film,
  History,
  Link2,
  MessageCircle,
  MonitorPlay,
  Play,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Video,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useRecentRooms } from '@/hooks/useRecentRooms'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createRoom } from '@/services/rooms'
import { CAPACITY_OPTIONS, DEFAULT_CAPACITY } from '@/lib/capacity'
import { isP2P } from '@/lib/mode'
import { mapApiError } from '@/lib/errors'
import { formatRelative } from '@/lib/format'
import { providerDisplayName, parseVideoUrl, type VideoParseFailure } from '@/lib/video'
import { parseRoomReference, shortRoomCode } from '@/lib/roomLink'
import { saveRecentRoom } from '@/lib/recentRooms'
import { safeExternalUrl } from '@/lib/utils'
import type { VideoProvider } from '@/types'

const STEPS = [
  {
    title: 'Oda oluştur',
    description: 'Bir video bağlantısı yapıştır veya boş oda oluştur.',
  },
  {
    title: 'Daveti paylaş',
    description: 'Tek tıkla kopyalanan bağlantıyı arkadaşlarına gönder.',
  },
  {
    title: 'Birlikte izleyin',
    description: 'Oynat, durdur, sar ve sohbet et — iki tarafta anında.',
  },
]

const FEATURES = [
  {
    icon: RefreshCw,
    title: 'Eşit kontrol',
    text: 'Oda sahibi ayrıcalığı yok. İki taraf da videoyu kontrol eder.',
  },
  {
    icon: Zap,
    title: 'Anlık senkron',
    text: 'Oynatma durumu, zaman çizgisi ve hız sunucu üzerinden eşitlenir.',
  },
  {
    icon: MessageCircle,
    title: 'Kalıcı sohbet',
    text: 'Mesajlar odada saklanır; sayfa yenilense de kaybolmaz.',
  },
  {
    icon: ShieldCheck,
    title: 'Güvenli erişim',
    text: 'Yalnızca oda üyeleri okuyup yazabilir. Kurallar sunucuda uygulanır.',
  },
]

const PROVIDERS: Array<{ provider: VideoProvider; label: string }> = [
  { provider: 'youtube', label: 'YouTube' },
  { provider: 'vimeo', label: 'Vimeo' },
  { provider: 'html5', label: 'MP4 / WebM / OGG' },
  { provider: 'hls', label: 'HLS (.m3u8)' },
  { provider: 'iframe', label: 'Gömülü web sayfası' },
]

function ProviderIcon({ provider, className }: { provider: VideoProvider; className?: string }) {
  switch (provider) {
    case 'youtube':
      return <MonitorPlay className={className} />
    case 'vimeo':
      return <Clapperboard className={className} />
    case 'hls':
      return <Radio className={className} />
    case 'html5':
      return <Film className={className} />
    case 'iframe':
      return <AppWindow className={className} />
    default:
      return <Video className={className} />
  }
}

export function HomePage() {
  const { user } = useAuth()
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { rooms, clear } = useRecentRooms()

  const [videoUrl, setVideoUrl] = useState('')
  const [videoFailure, setVideoFailure] = useState<VideoParseFailure | null>(null)
  const [capacity, setCapacity] = useState<number>(DEFAULT_CAPACITY)
  const [creating, setCreating] = useState(false)
  const [inviteInput, setInviteInput] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const videoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (location.hash === '#studio') {
      videoInputRef.current?.focus({ preventScroll: true })
    }
  }, [location.hash])

  const parsedVideo = useMemo(() => {
    const trimmed = videoUrl.trim()
    return trimmed ? parseVideoUrl(trimmed) : null
  }, [videoUrl])

  const liveFailure = parsedVideo && !parsedVideo.ok ? parsedVideo : null
  const externalFailureUrl =
    videoFailure && videoFailure.externalUrl ? safeExternalUrl(videoFailure.externalUrl) : null

  const handleCreateRoom = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!user || creating) return

    setVideoFailure(null)

    let source = null
    if (videoUrl.trim()) {
      const parsed = parseVideoUrl(videoUrl)
      if (!parsed.ok) {
        setVideoFailure(parsed)
        return
      }
      source = parsed.source
    }

    setCreating(true)
    try {
      const roomId = await createRoom(user, source, capacity)
      saveRecentRoom({
        id: roomId,
        provider: source?.provider ?? 'none',
        title: source ? providerDisplayName(source.provider) : 'Boş oda',
      })
      pushToast({
        kind: 'success',
        title: 'Oda oluşturuldu',
        description: `Kapasite ${capacity} kişi. Davet bağlantısını paylaşarak beklemeye başlayabilirsin.`,
      })
      // Sunucusuz modda kapasite davet bağlantısıyla taşınır.
      navigate(isP2P ? `/room/${roomId}?k=${capacity}` : `/room/${roomId}`)
    } catch (error) {
      pushToast({
        kind: 'error',
        title: 'Oda oluşturulamadı',
        description: mapApiError(error),
      })
    } finally {
      setCreating(false)
    }
  }

  const handleJoin = (event: FormEvent) => {
    event.preventDefault()
    setInviteError(null)
    const roomId = parseRoomReference(inviteInput)
    if (!roomId) {
      setInviteError('Geçerli bir davet bağlantısı veya oda kimliği girin.')
      return
    }
    navigate(`/room/${roomId}`)
  }

  const handleSearch = (event: FormEvent) => {
    event.preventDefault()
    const query = searchQuery.trim()
    if (!query) return
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      '_blank',
      'noopener,noreferrer',
    )
    pushToast({
      kind: 'info',
      title: 'Google yeni sekmede açıldı',
      description: 'Uygun videonun bağlantısını kopyalayıp "Video bağlantısı" alanına yapıştırın.',
    })
  }

  const showLiveFailure =
    liveFailure && videoUrl.trim().length > 12 && (!videoFailure || videoFailure === liveFailure)

  return (
    <PageShell className="pt-4 sm:pt-8">
      <section className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.7)]" />
          İstediğin kadar kişilik odalar
        </span>
        <h1 className="mt-5 font-display text-[34px] font-semibold leading-[1.08] tracking-tight text-zinc-50 sm:text-5xl lg:text-[56px]">
          Aynı ekranın karşısında
          <br className="hidden sm:block" /> <span className="text-gradient">gibi.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-[15px]">
          Bir bağlantı paylaş, aynı odaya girin. Video kontrolleri, zaman çizgisi ve sohbet herkeste
          anında senkronize olsun.
        </p>
      </section>

      <div className="mt-9 grid gap-4 lg:mt-12 lg:grid-cols-[1.4fr_0.6fr]">
        <section id="studio" className="panel scroll-mt-24 overflow-hidden">
          <div className="relative overflow-hidden border-b border-white/[0.06] bg-[radial-gradient(circle_at_25%_20%,rgba(139,92,246,.22),transparent_55%),radial-gradient(circle_at_85%_90%,rgba(34,211,238,.12),transparent_55%)] px-5 py-8 sm:px-8 sm:py-10">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.05) 1px, transparent 1px)',
                backgroundSize: '44px 44px',
                maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
              }}
            />
            <div className="relative flex flex-col items-center text-center">
              <div className="relative">
                <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] shadow-inner-line backdrop-blur">
                  <Play className="ml-1 h-6 w-6 fill-white text-white" />
                </div>
                <span className="absolute -right-3 -top-3 grid h-7 w-7 place-items-center rounded-full border border-brand-400/30 bg-night-800 text-brand-300 shadow-glow">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-5 font-display text-lg font-semibold text-zinc-100">İzleme alanı hazır</p>
              <p className="mt-1.5 max-w-md text-xs leading-relaxed text-zinc-500">
                Bir bağlantı yapıştırıp odayı oluştur. Katılan herkes davet bağlantısıyla aynı anda
                izlemeye başlar; kapasiteyi sen belirlersin.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-black/20 px-3 py-1.5 text-[11px] text-zinc-400">
                <Users className="h-3.5 w-3.5 text-brand-300" />
                Kapasiteyi sen seç · eşit kontrol yetkisi
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            <form onSubmit={(event) => void handleCreateRoom(event)}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="video-url" className="text-[13px] font-semibold text-zinc-200">
                  Video bağlantısı
                </label>
                <span className="text-[10px] text-zinc-600">İsteğe bağlı</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  ref={videoInputRef}
                  id="video-url"
                  value={videoUrl}
                  onChange={(event) => {
                    setVideoUrl(event.target.value)
                    setVideoFailure(null)
                  }}
                  leadingIcon={<Link2 className="h-4 w-4" />}
                  placeholder="https://www.youtube.com/watch?v=… veya bir film sayfası bağlantısı"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="url"
                  invalid={Boolean(videoFailure)}
                  aria-describedby="video-help"
                  containerClassName="flex-1"
                />

                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 sm:w-auto">
                  <Users className="h-4 w-4 shrink-0 text-zinc-500" />
                  <span className="text-[11px] font-medium text-zinc-400">Kapasite</span>
                  <select
                    id="room-capacity"
                    value={capacity}
                    onChange={(event) => setCapacity(Number(event.target.value))}
                    aria-label="Oda kapasitesi (kaç kişi)"
                    className="h-10 cursor-pointer appearance-none rounded-lg bg-transparent pr-1 text-[12px] font-semibold text-zinc-100 focus-visible:outline-none"
                  >
                    {CAPACITY_OPTIONS.map((option) => (
                      <option key={option} value={option} className="bg-night-900 text-zinc-100">
                        {option} kişi
                      </option>
                    ))}
                  </select>
                </label>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={creating}
                  className="h-10 shrink-0 sm:px-5"
                >
                  {!creating ? <Play className="h-4 w-4 fill-current" /> : null}
                  Oda oluştur
                </Button>
              </div>

              <div id="video-help" className="mt-2 min-h-[18px] text-[11px] leading-relaxed">
                {parsedVideo?.ok ? (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2 py-0.5 font-medium text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      {parsedVideo.providerLabel} algılandı
                    </span>
                    <span className="truncate text-zinc-500">{parsedVideo.title}</span>
                    {parsedVideo.source.startAt > 0 ? (
                      <span className="text-zinc-600">
                        · {parsedVideo.source.startAt}. saniyeden başlayacak
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {!parsedVideo && !videoFailure ? (
                  <span className="text-zinc-600">
                    YouTube, Vimeo, HLS veya doğrudan MP4/WebM bağlantısı — ya da gömülü açılan bir web
                    sayfası. Video eklemeden de oda oluşturabilirsin.
                  </span>
                ) : null}

                {videoFailure ? (
                  <div
                    role="alert"
                    className="mt-1 flex items-start gap-2 rounded-lg border border-amber-400/15 bg-amber-400/[0.06] px-2.5 py-2 text-amber-200/90"
                  >
                    <span className="mt-0.5">•</span>
                    <span>
                      {videoFailure.reason}
                      {externalFailureUrl ? (
                        <>
                          {' '}
                          <a
                            href={externalFailureUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-amber-300 underline decoration-amber-400/40 underline-offset-2 hover:text-amber-200"
                          >
                            Harici sekmede aç
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <span className="text-amber-200/60">
                            {' '}
                            — harici oynatıcı senkronize edilemez.
                          </span>
                        </>
                      ) : null}
                    </span>
                  </div>
                ) : null}

                {showLiveFailure && !videoFailure ? (
                  <p className="mt-1 text-[11px] text-zinc-500">{liveFailure?.reason}</p>
                ) : null}
              </div>
            </form>

            <div className="h-px w-full bg-white/[0.06]" />

            <form id="join" onSubmit={handleJoin} className="scroll-mt-28">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="invite-link" className="text-[13px] font-semibold text-zinc-200">
                  Davet bağlantın var mı?
                </label>
                <span className="text-[10px] text-zinc-600">Mevcut odaya katıl</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="invite-link"
                  value={inviteInput}
                  onChange={(event) => {
                    setInviteInput(event.target.value)
                    setInviteError(null)
                  }}
                  leadingIcon={<Users className="h-4 w-4" />}
                  placeholder="https://…/room/oda-kimliği veya oda kimliği"
                  autoComplete="off"
                  spellCheck={false}
                  invalid={Boolean(inviteError)}
                  containerClassName="flex-1"
                />
                <Button type="submit" variant="secondary" className="h-10 shrink-0 sm:px-5">
                  <ArrowRight className="h-4 w-4" />
                  Katıl
                </Button>
              </div>
              {inviteError ? (
                <p role="alert" className="mt-2 text-[11px] text-rose-300">
                  {inviteError}
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-zinc-600">
                  Oda yalnızca sunucuda gerçekten varsa açılır; rastgele kimliklerle yeni oda
                  oluşturulmaz.
                </p>
              )}
            </form>

            <div className="h-px w-full bg-white/[0.06]" />

            <form onSubmit={handleSearch}>
              <label htmlFor="google-search" className="text-[13px] font-semibold text-zinc-200">
                Önce Google'da ara
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input
                  id="google-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  leadingIcon={<Search className="h-4 w-4" />}
                  placeholder="Film adı, sahne veya video konusu…"
                  autoComplete="off"
                />
                <Button type="submit" variant="outline" className="h-10 shrink-0">
                  Google'da ara
                  <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
                </Button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
                Arama Google'ın kendi sekmesinde açılır. Sonuçta bulduğun YouTube/Vimeo bağlantısını
                yukarıdaki alana yapıştır. (Google arama sayfası iframe içine gömülmez.)
              </p>
            </form>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="panel p-5">
            <h2 className="text-sm font-semibold text-zinc-100">Nasıl çalışır?</h2>
            <ol className="mt-4 space-y-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-brand-400/20 bg-brand-500/10 text-[11px] font-semibold text-brand-300">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-zinc-200">{step.title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-500">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="panel p-5">
            <h2 className="text-sm font-semibold text-zinc-100">Desteklenen kaynaklar</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {PROVIDERS.map((item) => (
                <span
                  key={item.provider}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1.5 text-[11px] text-zinc-400"
                >
                  <ProviderIcon provider={item.provider} className="h-3.5 w-3.5 text-brand-300/80" />
                  {item.label}
                </span>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-amber-400/10 bg-amber-400/[0.04] p-3 text-[11px] leading-relaxed text-amber-200/70">
              Netflix, Disney+, Prime Video gibi DRM korumalı servisler ve gömülü oynatmayı
              engelleyen siteler iframe olarak açılmaz. Bu kaynaklar için odadaki{' '}
              <strong className="font-semibold text-amber-200">ekran paylaşımı</strong> modunu kullan.
            </div>
          </div>
        </aside>
      </div>

      {rooms.length > 0 ? (
        <section className="mt-10">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
                <History className="h-4 w-4 text-zinc-500" />
                Son odaların
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Bu tarayıcıda açtığın odalara hızlıca dönebilirsin.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clear()
                pushToast({ kind: 'info', title: 'Geçmiş temizlendi' })
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Temizle
            </Button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <Link
                key={room.id}
                to={`/room/${room.id}`}
                className="panel-soft group flex items-center gap-3 p-3.5 transition duration-200 hover:border-brand-400/20 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-night-800 text-brand-300">
                  <ProviderIcon provider={room.provider} className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-zinc-200">
                    {room.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-zinc-600">
                    Oda {shortRoomCode(room.id)} · {formatRelative(room.visitedAt)}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-brand-300" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="panel-soft p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-brand-300">
              <feature.icon className="h-4 w-4" />
            </span>
            <h3 className="mt-3 text-[13px] font-semibold text-zinc-200">{feature.title}</h3>
            <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">{feature.text}</p>
          </div>
        ))}
      </section>
    </PageShell>
  )
}
