import { useCallback, useEffect, useRef } from 'react'
import type { RoomSignal } from '@/types'
import { api } from '@/lib/api'
import { getRoomChannel } from '@/lib/roomChannel'

type SignalHandler = (signal: RoomSignal) => void

/**
 * Oda içindeki hafif eşzamanlama sinyallerini dinler ve gönderir.
 * Kullanım: gömülü sayfa sayacı, ekran paylaşımı (WebRTC) el sıkışması.
 *
 * Sunucu sinyalleri yorumlamadan odaya iletir; kendi gönderdiğimiz sinyaller
 * yoksayılır, böylece döngü oluşmaz.
 */
export function useRoomSignals(roomId: string, uid: string) {
  const handlersRef = useRef(new Map<string, Set<SignalHandler>>())

  useEffect(() => {
    const channel = getRoomChannel(roomId)
    return channel.subscribe((event) => {
      if (event.type !== 'signal') return
      if (event.signal.from === uid) return

      const handlers = handlersRef.current.get(event.signal.type)
      if (!handlers) return

      for (const handler of handlers) {
        try {
          handler(event.signal)
        } catch (error) {
          console.error('[sinyal] işleyici hatası:', error)
        }
      }
    })
  }, [roomId, uid])

  /** Belirtilen türdeki sinyalleri dinlemeye başlar; dönen fonksiyon kaydı siler. */
  const on = useCallback((type: string, handler: SignalHandler): (() => void) => {
    const handlers = handlersRef.current.get(type) ?? new Set<SignalHandler>()
    handlers.add(handler)
    handlersRef.current.set(type, handlers)

    return () => {
      const current = handlersRef.current.get(type)
      if (!current) return
      current.delete(handler)
      if (current.size === 0) handlersRef.current.delete(type)
    }
  }, [])

  const send = useCallback(
    async (type: string, data?: unknown): Promise<void> => {
      try {
        await api.signal(roomId, type, data)
      } catch (error) {
        console.error('[sinyal] gönderilemedi:', type, error)
      }
    },
    [roomId],
  )

  return { on, send }
}
