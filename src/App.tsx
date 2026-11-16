import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react'
import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { isP2P } from '@/lib/mode'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ConnectionProvider } from '@/context/ConnectionContext'
import { ToastProvider } from '@/context/ToastContext'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { SplashScreen } from '@/components/auth/SplashScreen'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { HomePage } from '@/pages/HomePage'
import { RoomPage } from '@/pages/RoomPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export function App() {
  // Sunucusuz modda GitHub Pages bilinmeyen yollar için 404 döndürdüğünden
  // yönlendirme hash üzerinden yapılır.
  const Router = isP2P ? HashRouter : BrowserRouter

  return (
    <AppErrorBoundary>
      <ToastProvider>
        <Router>
          <AppRoot />
        </Router>
      </ToastProvider>
    </AppErrorBoundary>
  )
}

function AppRoot() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
}

function AuthGate() {
  const { user, loading } = useAuth()

  if (loading) return <SplashScreen />
  if (!user) return <LoginScreen />

  return (
    <ConnectionProvider>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
        <Route path="/join/:roomId" element={<JoinRedirect />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ConnectionProvider>
  )
}

function JoinRedirect() {
  const { roomId } = useParams<{ roomId: string }>()
  return <Navigate to={roomId ? `/room/${roomId}` : '/'} replace />
}

/**
 * Hash hedeflerine kaydırır; normal sayfa geçişlerinde en üste döner.
 * `/#studio` gibi bağlantılar giriş sonrası doğru alana götürür.
 */
function ScrollManager() {
  const { pathname, hash, key } = useLocation()

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1))
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
    if (!hash) window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname, hash, key])

  return null
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uygulama hatası:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center px-4 py-12">
          <div className="panel w-full max-w-md p-6 text-center sm:p-8">
            <div className="mb-6 flex justify-center">
              <Logo markClassName="h-10 w-10" />
            </div>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-rose-400/20 bg-rose-500/10 text-rose-300">
              <TriangleAlert className="h-5 w-5" />
            </span>
            <h1 className="mt-4 text-xl font-semibold text-zinc-50">Beklenmeyen bir hata oluştu</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Uygulama bu ekranı güvenli biçimde durdurdu. Sayfayı yenilemek genellikle sorunu
              çözer. Sorun devam ederse tarayıcı konsolundaki ayrıntılara bakabilirsin.
            </p>
            <Button
              variant="primary"
              className="mt-6"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4" />
              Sayfayı yenile
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
