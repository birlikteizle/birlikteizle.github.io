import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { createCommandId } from '@/lib/ids'
import { cn } from '@/lib/utils'

export type ToastKind = 'success' | 'error' | 'info' | 'warning'

export interface ToastOptions {
  title: string
  description?: string
  kind?: ToastKind
  duration?: number
}

interface ToastItem extends Required<Pick<ToastOptions, 'title' | 'kind'>> {
  id: string
  description?: string
}

interface ToastContextValue {
  pushToast: (options: ToastOptions) => string
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
} as const

const ACCENTS: Record<ToastKind, string> = {
  success: 'text-emerald-400',
  error: 'text-rose-400',
  info: 'text-sky-400',
  warning: 'text-amber-400',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const pushToast = useCallback(
    (options: ToastOptions) => {
      const id = createCommandId()
      const item: ToastItem = {
        id,
        title: options.title,
        description: options.description,
        kind: options.kind ?? 'info',
      }

      setToasts((current) => [...current.slice(-3), item])

      const duration = options.duration ?? (item.kind === 'error' ? 7000 : 4500)
      const timer = setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id))
        timers.current.delete(id)
      }, duration)
      timers.current.set(id, timer)

      return id
    },
    [],
  )

  useEffect(() => {
    const activeTimers = timers.current
    return () => {
      for (const timer of activeTimers.values()) clearTimeout(timer)
      activeTimers.clear()
    }
  }, [])

  const value = useMemo<ToastContextValue>(() => ({ pushToast, dismissToast }), [pushToast, dismissToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex flex-col items-end gap-2 p-3 sm:bottom-4 sm:left-auto sm:right-4 sm:p-0"
          role="region"
          aria-label="Bildirimler"
          aria-live="polite"
        >
          {toasts.map((toast) => {
            const Icon = ICONS[toast.kind]
            return (
              <div
                key={toast.id}
                className="pointer-events-auto w-full max-w-sm animate-slide-in-right rounded-2xl border border-white/10 bg-night-800/95 p-3.5 shadow-panel backdrop-blur-xl"
              >
                <div className="flex items-start gap-3">
                  <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', ACCENTS[toast.kind])} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-100">{toast.title}</p>
                    {toast.description ? (
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{toast.description}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissToast(toast.id)}
                    className="rounded-lg p-1 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                    aria-label="Bildirimi kapat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast, ToastProvider içinde kullanılmalıdır.')
  return context
}
