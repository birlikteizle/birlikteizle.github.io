import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { isP2P } from '@/lib/mode'

export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting' | 'offline'

interface ConnectionContextValue {
  status: ConnectionStatus
  isOnline: boolean
  isReconnecting: boolean
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null)

const POLL_INTERVAL_MS = 10_000

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    typeof navigator === 'undefined' || navigator.onLine ? 'connecting' : 'offline',
  )

  useEffect(() => {
    // Sunucusuz modda bağlantı durumu tarayıcının çevrimiçi hâline dayanır;
    // yoklanacak bir API sunucusu yoktur.
    if (isP2P) {
      const update = () => setStatus(navigator.onLine ? 'online' : 'offline')
      update()
      window.addEventListener('online', update)
      window.addEventListener('offline', update)
      return () => {
        window.removeEventListener('online', update)
        window.removeEventListener('offline', update)
      }
    }

    let cancelled = false
    let controller: AbortController | null = null

    const check = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!cancelled) setStatus('offline')
        return
      }

      controller?.abort()
      controller = new AbortController()

      try {
        await api.health(controller.signal)
        if (!cancelled) setStatus('online')
      } catch (error) {
        if (cancelled || (error as { name?: string }).name === 'AbortError') return
        setStatus(navigator.onLine ? 'reconnecting' : 'offline')
      }
    }

    void check()
    const interval = window.setInterval(() => void check(), POLL_INTERVAL_MS)

    const handleOnline = () => {
      setStatus('connecting')
      void check()
    }
    const handleOffline = () => setStatus('offline')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      cancelled = true
      controller?.abort()
      window.clearInterval(interval)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const value = useMemo<ConnectionContextValue>(
    () => ({
      status,
      isOnline: status === 'online',
      isReconnecting: status === 'connecting' || status === 'reconnecting',
    }),
    [status],
  )

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>
}

export function useConnection(): ConnectionContextValue {
  const context = useContext(ConnectionContext)
  if (!context) throw new Error('useConnection, ConnectionProvider içinde kullanılmalıdır.')
  return context
}
