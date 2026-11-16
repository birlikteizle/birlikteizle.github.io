import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  Copy,
  Database,
  History,
  Info,
  LogOut,
  Mail,
  MonitorSmartphone,
  ShieldCheck,
  Trash2,
  UserRound,
  Wifi,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useConnection } from '@/context/ConnectionContext'
import { useToast } from '@/context/ToastContext'
import { useRecentRooms } from '@/hooks/useRecentRooms'
import { PageShell } from '@/components/layout/PageShell'
import { Avatar, PresenceDot } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { apiBaseUrl } from '@/lib/api'
import { formatRelative } from '@/lib/format'
import { providerDisplayName } from '@/lib/video'
import { shortRoomCode } from '@/lib/roomLink'
import { copyText } from '@/lib/utils'

export function SettingsPage() {
  const { user, signOutUser } = useAuth()
  const { status, isOnline } = useConnection()
  const { pushToast } = useToast()
  const { rooms, clear } = useRecentRooms()
  const navigate = useNavigate()
  const [copiedUid, setCopiedUid] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Ayarlar · Birlikte İzle'
    return () => {
      document.title = previousTitle
    }
  }, [])

  if (!user) return null

  const displayName = user.displayName?.trim() || 'Kullanıcı'

  const handleCopyUid = async () => {
    const ok = await copyText(user.uid)
    if (ok) {
      setCopiedUid(true)
      window.setTimeout(() => setCopiedUid(false), 1800)
      pushToast({ kind: 'success', title: 'Kullanıcı kimliği kopyalandı' })
    } else {
      pushToast({ kind: 'warning', title: 'Kopyalanamadı' })
    }
  }

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await signOutUser()
      navigate('/')
      pushToast({ kind: 'info', title: 'Çıkış yapıldı' })
    } catch {
      pushToast({ kind: 'error', title: 'Çıkış yapılamadı' })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-zinc-50 sm:text-3xl">Ayarlar</h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Hesabın, bağlantı durumun ve bu tarayıcıdaki oda geçmişin.
          </p>
        </header>

        <section className="panel overflow-hidden">
          <div className="relative overflow-hidden border-b border-white/[0.06] bg-[radial-gradient(circle_at_20%_10%,rgba(139,92,246,.2),transparent_55%),radial-gradient(circle_at_90%_90%,rgba(34,211,238,.1),transparent_55%)] px-5 py-6 sm:px-6">
            <div className="flex items-center gap-4">
              <Avatar src={user.photoURL} name={displayName} size="lg" status={isOnline ? 'online' : 'reconnecting'} />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-zinc-50">{displayName}</h2>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-zinc-400">
                  <Mail className="h-3 w-3 shrink-0 text-zinc-500" />
                  {user.email ?? 'E-posta kullanılmıyor'}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    Yerel oturum
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[9px] font-medium text-zinc-500">
                    Oturum kalıcı
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-white/[0.05] sm:grid-cols-2">
            <div className="bg-night-850 p-5">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <UserRound className="h-3.5 w-3.5" />
                Kullanıcı kimliği
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1.5 font-mono text-[10px] text-zinc-400">
                  {user.uid}
                </code>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void handleCopyUid()}
                  aria-label="Kullanıcı kimliğini kopyala"
                >
                  {copiedUid ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-600">
                Üyelikler ve mesajlar bu yerel kullanıcı kimliğine bağlıdır.
              </p>
            </div>

            <div className="bg-night-850 p-5">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <Wifi className="h-3.5 w-3.5" />
                Bağlantı
              </p>
              <div className="mt-2 flex items-center gap-2 text-sm text-zinc-200">
                <PresenceDot
                  status={status === 'online' ? 'online' : status === 'offline' ? 'offline' : 'reconnecting'}
                />
                {status === 'online'
                  ? 'Sunucuya bağlı'
                  : status === 'offline'
                    ? 'Çevrimdışı'
                    : 'Yeniden bağlanıyor'}
              </div>
              <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-600">
                Bağlantı koptuğunda oynatma kontrolleri devre dışı kalır; bağlantı geri geldiğinde
                oda durumuyla yeniden eşitlenir.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-4 sm:px-6">
            <p className="text-[11px] text-zinc-500">
              Çıkış yaptığında bu cihazdaki oturum kapanır; oda üyeliklerin korunur.
            </p>
            <Button variant="danger" size="sm" loading={signingOut} onClick={() => void handleSignOut()}>
              {!signingOut ? <LogOut className="h-3.5 w-3.5" /> : null}
              Çıkış yap
            </Button>
          </div>
        </section>

        <section className="panel mt-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <History className="h-4 w-4 text-zinc-500" />
                Bu cihazdaki odalar
              </h2>
              <p className="mt-1 text-[11px] text-zinc-500">
                Son odalar yalnızca bu tarayıcıda saklanır; sunucuya gönderilmez.
              </p>
            </div>
            {rooms.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clear()
                  pushToast({ kind: 'info', title: 'Oda geçmişi temizlendi' })
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Temizle
              </Button>
            ) : null}
          </div>

          {rooms.length === 0 ? (
            <p className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-center text-[11px] text-zinc-600">
              Henüz bir odaya katılmadın. Ana sayfadan oda oluşturabilir veya davet bağlantısıyla
              katılabilirsin.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {rooms.map((room) => (
                <Link
                  key={room.id}
                  to={`/room/${room.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition hover:border-brand-400/20 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-night-800 text-brand-300">
                    <MonitorSmartphone className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-zinc-200">
                      {room.title}
                    </span>
                    <span className="block text-[10px] text-zinc-600">
                      {providerDisplayName(room.provider)} · Oda {shortRoomCode(room.id)} ·{' '}
                      {formatRelative(room.visitedAt)}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-brand-300" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="panel mt-4 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Database className="h-4 w-4 text-zinc-500" />
            Teknik bilgiler
          </h2>
          <dl className="mt-4 space-y-2.5 text-[11.5px]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] pb-2.5">
              <dt className="text-zinc-500">Sunucu adresi</dt>
              <dd className="font-mono text-zinc-300">{apiBaseUrl() || window.location.origin}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] pb-2.5">
              <dt className="text-zinc-500">Gerçek zamanlı kanal</dt>
              <dd className="text-zinc-300">SSE · sunucu zaman damgası</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] pb-2.5">
              <dt className="text-zinc-500">Durum deposu</dt>
              <dd className="text-zinc-300">.data/state.json</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-zinc-500">Ortam</dt>
              <dd className="text-zinc-300">{import.meta.env.PROD ? 'Üretim derlemesi' : 'Geliştirme'}</dd>
            </div>
          </dl>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-sky-400/10 bg-sky-400/[0.04] px-3 py-2.5 text-[10.5px] leading-relaxed text-sky-200/70">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              Oda durumu, mesajlar ve oynatma konumu kendi sunucunda tutulur. Böylece ek hesap ya
              da dış servis kurulumu gerekmeden iki kişi aynı odada senkron izleyebilir.
            </p>
          </div>
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1 text-[10.5px] text-zinc-600">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            Oda erişimi sunucu tarafında doğrulanır.
          </span>
          <span className="inline-flex items-center gap-1.5">
            Yerel sunucu · {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </PageShell>
  )
}
