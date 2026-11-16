import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

/** Sunucu saat kaymasını telafi etmek için ölçülen fark (ms). */
export function useServerTimeOffset(): number {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    let cancelled = false
    let controller: AbortController | null = null

    const measure = async () => {
      controller?.abort()
      controller = new AbortController()
      const startedAt = Date.now()

      try {
        const { now } = await api.time(controller.signal)
        if (cancelled) return
        const roundTrip = Date.now() - startedAt
        setOffset(now + roundTrip / 2 - Date.now())
      } catch {
        /* Sunucuya ulaşılamazsa mevcut ölçüm korunur. */
      }
    }

    void measure()
    const interval = window.setInterval(() => void measure(), 30_000)

    return () => {
      cancelled = true
      controller?.abort()
      window.clearInterval(interval)
    }
  }, [])

  return offset
}
