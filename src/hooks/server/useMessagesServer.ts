import { useCallback, useEffect, useState } from 'react'
import type { ChatMessage } from '@/types'
import { getRoomChannel } from '@/lib/roomChannel'

interface UseMessagesResult {
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  retry: () => void
}

function normalizeMessage(value: ChatMessage): ChatMessage | null {
  if (!value || typeof value.text !== 'string' || typeof value.senderId !== 'string') return null
  return {
    id: typeof value.id === 'string' ? value.id : `${value.senderId}-${value.createdAt ?? 0}`,
    senderId: value.senderId,
    senderName: typeof value.senderName === 'string' ? value.senderName : 'Kullanıcı',
    photoURL: typeof value.photoURL === 'string' ? value.photoURL : null,
    text: value.text,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : null,
  }
}

/** Sunucu modu: mesajlar SSE kanalından gelir. */
export function useMessagesServer(roomId: string): UseMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const channel = getRoomChannel(roomId)
    return channel.subscribe((event) => {
      if (event.type === 'snapshot') {
        const list = event.snapshot.messages
          .map(normalizeMessage)
          .filter((message): message is ChatMessage => message !== null)
        setMessages(list)
        setLoading(false)
      } else if (event.type === 'message') {
        const message = normalizeMessage(event.message)
        if (!message) return
        setMessages((previous) =>
          previous.some((item) => item.id === message.id) ? previous : [...previous, message],
        )
        setLoading(false)
      }
    })
  }, [roomId, retryKey])

  const retry = useCallback(() => setRetryKey((value) => value + 1), [])

  return { messages, loading, error, retry }
}