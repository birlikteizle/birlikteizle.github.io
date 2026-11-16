import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AppUser } from '@/types'
import { ApiError, api } from '@/lib/api'
import { clearSession, readSession, writeSession } from '@/lib/session'
import { closeAllChannels } from '@/lib/roomChannel'

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  signingIn: boolean
  authError: string | null
  serverReachable: boolean
  signInWithName: (displayName: string) => Promise<void>
  signOutUser: () => Promise<void>
  clearAuthError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [serverReachable, setServerReachable] = useState(true)

  useEffect(() => {
    const session = readSession()
    if (!session) {
      setLoading(false)
      return
    }

    setUser(session.user)
    let cancelled = false
    const controller = new AbortController()

    api
      .me(session.token, controller.signal)
      .then(({ user: verified }) => {
        if (cancelled) return
        setServerReachable(true)
        setUser(verified)
        writeSession({ user: verified, token: session.token })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 401) {
          clearSession()
          setUser(null)
          return
        }
        if (error instanceof ApiError && error.code === 'NETWORK') {
          setServerReachable(false)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const signInWithName = useCallback(async (displayName: string) => {
    setSigningIn(true)
    setAuthError(null)
    try {
      const result = await api.register(displayName)
      writeSession({ user: result.user, token: result.token })
      setUser(result.user)
      setServerReachable(true)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'NETWORK') setServerReachable(false)
      setAuthError(error instanceof Error ? error.message : 'Giriş yapılamadı. Lütfen tekrar dene.')
    } finally {
      setSigningIn(false)
    }
  }, [])

  const signOutUser = useCallback(async () => {
    closeAllChannels()
    clearSession()
    setAuthError(null)
    setUser(null)
  }, [])

  const clearAuthError = useCallback(() => setAuthError(null), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signingIn,
      authError,
      serverReachable,
      signInWithName,
      signOutUser,
      clearAuthError,
    }),
    [
      user,
      loading,
      signingIn,
      authError,
      serverReachable,
      signInWithName,
      signOutUser,
      clearAuthError,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth, AuthProvider içinde kullanılmalıdır.')
  return context
}
