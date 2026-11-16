import { useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  MessageCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  WifiOff,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Logo, LogoMark } from '@/components/ui/Logo'
import { Avatar } from '@/components/ui/Avatar'

const FEATURES = [
  {
    icon: RefreshCw,
    title: 'Saniye saniye senkron',
    description: 'Oynat, durdur, ileri sar. İki ekranda da aynı an.',
  },
  {
    icon: MessageCircle,
    title: 'Aynı odada sohbet',
    description: 'Film keyfi mesajlarla daha iyi. Geçmiş kalıcı olarak saklanır.',
  },
  {
    icon: ShieldCheck,
    title: 'İki kişilik özel oda',
    description: 'Tahmin edilmesi imkânsız davet bağlantısı ve üye bazlı erişim.',
  },
]

export function LoginScreen() {
  const { signInWithName, signingIn, authError, clearAuthError, serverReachable } = useAuth()
  const [name, setName] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const displayName = name.trim()
    if (!displayName) {
      setLocalError('Devam etmek için bir ad yaz.')
      return
    }
    setLocalError(null)
    clearAuthError()
    void signInWithName(displayName)
  }

  const shownError = localError ?? authError

  return (
    <div className="relative min-h-[100dvh] overflow-hidden lg:grid lg:grid-cols-[1.08fr_1fr]">
      {/* Sol / marka paneli */}
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.06] bg-night-900/40 p-10 lg:flex xl:p-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.05) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse at 30% 20%, black 10%, transparent 70%)',
          }}
        />
        <div className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-brand-600/20 blur-[110px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px]" />

        <div className="relative z-10">
          <Logo markClassName="h-10 w-10" />
        </div>

        <div className="relative z-10 max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-400/20 bg-brand-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-200">
            <Sparkles className="h-3.5 w-3.5" />
            Gerçek zamanlı izleme
          </div>

          <h1 className="font-display text-5xl font-semibold leading-[1.08] tracking-tight text-zinc-50 xl:text-[56px]">
            Aynı filmi,
            <br />
            <span className="text-gradient">aynı saniyede</span> izleyin.
          </h1>

          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-zinc-400">
            Farklı şehirlerde olsanız da aynı ekranın karşısındaymış gibi. Video kontrolleri,
            mesajlar ve çevrimiçi durum her iki tarafta anında senkronize olur.
          </p>

          <ul className="mt-9 space-y-5">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex gap-3.5">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-brand-300">
                  <feature.icon className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-zinc-200">{feature.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-500">
                    {feature.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Dekoratif oynatıcı önizlemesi */}
        <div className="relative z-10 mt-12">
          <div className="pointer-events-none relative max-w-md animate-float rounded-2xl border border-white/[0.08] bg-night-850/80 p-3 shadow-panel backdrop-blur-xl">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,.35),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(34,211,238,.18),transparent_55%)]">
              <div className="absolute inset-0 grid place-items-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur">
                  <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
                </span>
              </div>
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/40 px-2 py-1 text-[10px] font-semibold text-emerald-300 backdrop-blur">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Senkron
              </div>
              <div className="absolute inset-x-3 bottom-3">
                <div className="h-1 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full w-[42%] rounded-full bg-gradient-to-r from-brand-400 to-cyan-400" />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[9px] text-white/70">
                  <span>00:42:18</span>
                  <span>01:38:04</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-1 pt-3">
              <div className="flex -space-x-2">
                <Avatar name="Sen" size="xs" status="online" />
                <Avatar name="Partner" size="xs" status="online" />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <MessageCircle className="h-3 w-3" />
                Birlikte izliyorsunuz
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sağ / giriş paneli */}
      <section className="relative flex min-h-[100dvh] flex-col justify-center px-5 py-10 sm:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-brand-600/10 to-transparent lg:hidden" />

        <div className="relative mx-auto w-full max-w-[400px] animate-fade-up">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Logo />
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
              Canlı senkron
            </span>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-night-850/85 p-6 shadow-panel backdrop-blur-xl sm:p-8">
            <div className="mb-7">
              <div className="mb-4 flex items-center gap-3 lg:hidden">
                <LogoMark className="h-10 w-10" />
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
                  <Users className="h-3.5 w-3.5 text-brand-300" />
                  İki kişilik özel odalar
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-zinc-50">Birlikte izlemeye başla</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Adını yaz, odanı oluştur ve davet bağlantısını paylaş. Hesap, şifre veya ek
                kurulum gerekmez.
              </p>
            </div>

            {shownError ? (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.08] p-3 text-xs leading-relaxed text-rose-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{shownError}</span>
              </div>
            ) : null}

            {!serverReachable ? (
              <div
                role="status"
                className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] p-3 text-xs leading-relaxed text-amber-200"
              >
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Sunucuya ulaşılamıyor. Terminalde <code>node server/index.mjs</code> komutunun
                  çalıştığından emin ol.
                </span>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-3">
              <label
                htmlFor="display-name"
                className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
              >
                Görünecek adın
              </label>
              <Input
                id="display-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setLocalError(null)
                  clearAuthError()
                }}
                leadingIcon={<UserRound className="h-4 w-4" />}
                placeholder="Örn. Ayşe"
                autoComplete="nickname"
                maxLength={40}
                autoFocus
                disabled={signingIn}
                invalid={Boolean(shownError)}
                aria-label="Görünecek adın"
              />

              <Button
                type="submit"
                disabled={signingIn}
                className="h-12 w-full rounded-xl bg-white text-[14px] font-semibold text-night-950 shadow-[0_12px_30px_-12px_rgba(255,255,255,.35)] transition hover:bg-zinc-100"
              >
                {signingIn ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                ) : (
                  <Play className="h-[18px] w-[18px] fill-current" />
                )}
                {signingIn ? 'Hazırlanıyor…' : 'Birlikte izlemeye başla'}
                {!signingIn ? <ArrowRight className="ml-auto h-4 w-4 text-zinc-500" /> : null}
              </Button>
            </form>

            <div className="mt-5 flex items-start gap-2 border-t border-white/[0.06] pt-5 text-[11px] leading-relaxed text-zinc-600">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
              <p>
                Oturum yalnızca bu tarayıcıda saklanır. Adres çubuğundaki davet bağlantısını
                paylaşarak ikinci kişiyi odaya alabilirsin.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] text-zinc-600">
            Sunucu ve oda durumu aynı makinede çalışır; aynı ağdaki cihazlar bağlantı adresiyle
            katılabilir.
          </p>
        </div>
      </section>
    </div>
  )
}
