import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, Plus, Settings } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useConnection } from '@/context/ConnectionContext'
import { useToast } from '@/context/ToastContext'
import { Avatar } from '@/components/ui/Avatar'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/lib/utils'

export function AppHeader() {
  const { user, signOutUser } = useAuth()
  const { isOnline } = useConnection()
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  if (!user) return null

  const displayName = user.displayName?.trim() || user.email?.split('@')[0] || 'Kullanıcı'

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOutUser()
      navigate('/')
      pushToast({ kind: 'info', title: 'Çıkış yapıldı' })
    } catch {
      pushToast({ kind: 'error', title: 'Çıkış yapılamadı', description: 'Lütfen tekrar deneyin.' })
    } finally {
      setSigningOut(false)
      setMenuOpen(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-night-950/75 backdrop-blur-xl">
      <div className="mx-auto flex h-[64px] w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-7">
          <Link
            to="/"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-night-950"
            aria-label="Birlikte İzle ana sayfa"
          >
            <Logo markClassName="h-8 w-8" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Ana gezinme">
            <Link
              to="/"
              className={cn(
                'rounded-lg px-3 py-2 text-[13px] font-medium transition',
                location.pathname === '/'
                  ? 'bg-white/[0.06] text-zinc-100'
                  : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200',
              )}
            >
              Ana Sayfa
            </Link>
            <Link
              to="/#studio"
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-200"
            >
              Oda Oluştur
            </Link>
            <Link
              to="/#join"
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-200"
            >
              Davetle Katıl
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/#studio"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.08] md:hidden"
          >
            <Plus className="h-3.5 w-3.5" />
            Oda
          </Link>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-full border border-transparent p-0.5 pr-1 transition hover:border-white/10 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <Avatar
                src={user.photoURL}
                name={displayName}
                size="sm"
                status={isOnline ? 'online' : 'reconnecting'}
              />
              <span className="hidden max-w-[120px] truncate text-[13px] font-medium text-zinc-300 lg:block">
                {displayName}
              </span>
              <ChevronDown
                className={cn('h-3.5 w-3.5 text-zinc-500 transition', menuOpen && 'rotate-180')}
              />
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-64 animate-scale-in overflow-hidden rounded-2xl border border-white/10 bg-night-800/95 p-1.5 shadow-panel backdrop-blur-xl"
              >
                <div className="flex items-center gap-3 px-3 py-3">
                  <Avatar src={user.photoURL} name={displayName} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-100">{displayName}</p>
                    <p className="truncate text-[11px] text-zinc-500">{user.email}</p>
                  </div>
                </div>
                <div className="mx-2 h-px bg-white/[0.07]" />
                <Link
                  to="/settings"
                  role="menuitem"
                  className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-zinc-300 transition hover:bg-white/[0.06] hover:text-zinc-100"
                >
                  <Settings className="h-4 w-4 text-zinc-500" />
                  Ayarlar
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleSignOut()}
                  disabled={signingOut}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] text-zinc-300 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4 text-zinc-500" />
                  {signingOut ? 'Çıkış yapılıyor…' : 'Çıkış yap'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
