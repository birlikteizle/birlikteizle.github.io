import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '@/types'
import { retainP2PRoom } from '@/lib/p2p/room'

interface UseMessagesResult {
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  retry: () => void
}

/**
 * Sunucusuz (P2P) sohbet. Mesajlar doğrudan karşı tarafa gönderilir.
 *
 * Kalıcı depo olmadığı için geçmiş yalnızca bellekte tutulur; odaya sonradan
 * katılan tarafa mevcut geçmiş birkaç mesajlık paketler hâlinde aktarılır.
 */
export function useMessagesP2P(roomId: string): UseMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages

  useEffect(() => {
    setLoading(false)

    const { room, release } = retainP2PRoom(roomId)
    const unsubscribe = room.subscribe((event) => {
      if (event.type === 'chat') {
        const message = event.message
        if (!message || typeof message.text !== 'string') return
        setMessages((previous) =>
          previous.some((item) => item.id === message.id) ? previous : [...previous, message],
        )
      } else if (event.type === 'history') {
        setMessages((previous) => {
          const merged = new Map(previous.map((item) => [item.id, item]))
          for (const item of event.messages) {
            if (item && typeof item.text === 'string' && !merged.has(item.id)) merged.set(item.id, item)
          }
          return [...merged.values()].sort(
            (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
          )
        })
      } else if (event.type === 'hello') {
        // Yeni katılan tarafa mevcut geçmişi gönder.
        if (messagesRef.current.length > 0) room.sendHistory(messagesRef.current)
      }
    })

    return () => {
      unsubscribe()
      release()
    }
  }, [roomId, retryKey])

  const retry = useCallback(() => setRetryKey((value) => value + 1), [])

  return { messages, loading, error, retry }
}