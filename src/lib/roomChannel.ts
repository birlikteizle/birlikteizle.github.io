import type {
  ChatMessage,
  PlaybackState,
  RoomInfo,
  RoomMembers,
  RoomPresenceMap,
  RoomSignal,
  RoomSnapshot,
} from '@/types'
import { apiBaseUrl } from '@/lib/api'
import { currentToken } from '@/lib/session'

export type RoomChannelEvent =
  | { type: 'snapshot'; snapshot: RoomSnapshot }
  | { type: 'playback'; playback: PlaybackState }
  | { type: 'presence'; presence: RoomPresenceMap }
  | { type: 'members'; members: RoomMembers }
  | { type: 'message'; message: ChatMessage }
  | { type: 'info'; info: RoomInfo }
  | { type: 'signal'; signal: RoomSignal }
  | { type: 'status'; connected: boolean }

type Listener = (event: RoomChannelEvent) => void

const EVENT_NAMES = [
  'snapshot',
  'playback',
  'presence',
  'members',
  'message',
  'info',
  'signal',
] as const

/**
 * Oda başına tek bir SSE bağlantısı paylaşılır. Oynatma, sohbet ve üyelik
 * hook'ları aynı kanalı dinlediği için sunucuya tek bağlantı açılır.
 */
class RoomChannel {
  readonly roomId: string
  private source: EventSource | null = null
  private listeners = new Set<Listener>()
  private lastSnapshot: RoomSnapshot | null = null
  private connected = false

  constructor(roomId: string) {
    this.roomId = roomId
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    if (this.listeners.size === 1) this.open()
    if (this.lastSnapshot) listener({ type: 'snapshot', snapshot: this.lastSnapshot })

    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) {
        this.close()
        if (channels.get(this.roomId) === this) channels.delete(this.roomId)
      }
    }
  }

  private emit(event: RoomChannelEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        console.error('[oda] dinleyici hatası:', error)
      }
    }
  }

  private open(): void {
    if (this.source) return

    const token = currentToken()
    if (!token) return

    const url = `${apiBaseUrl()}/api/rooms/${this.roomId}/stream?token=${encodeURIComponent(token)}`
    const source = new EventSource(url)
    this.source = source

    source.onopen = () => {
      if (this.connected) return
      this.connected = true
      this.emit({ type: 'status', connected: true })
    }

    source.onerror = () => {
      if (this.source !== source) return
      if (!this.connected) return
      this.connected = false
      this.emit({ type: 'status', connected: false })
    }

    const handle = (eventName: (typeof EVENT_NAMES)[number], raw: MessageEvent<string>) => {
      let payload: unknown
      try {
        payload = JSON.parse(raw.data)
      } catch {
        return
      }

      switch (eventName) {
        case 'snapshot': {
          const snapshot = payload as RoomSnapshot
          this.lastSnapshot = snapshot
          this.emit({ type: 'snapshot', snapshot })
          break
        }
        case 'playback':
          this.emit({ type: 'playback', playback: (payload as { playback: PlaybackState }).playback })
          break
        case 'presence':
          this.emit({
            type: 'presence',
            presence: (payload as { presence: RoomPresenceMap }).presence,
          })
          break
        case 'members':
          this.emit({ type: 'members', members: (payload as { members: RoomMembers }).members })
          break
        case 'message':
          this.emit({ type: 'message', message: (payload as { message: ChatMessage }).message })
          break
        case 'info':
          this.emit({ type: 'info', info: (payload as { info: RoomInfo }).info })
          break
        case 'signal':
          this.emit({ type: 'signal', signal: payload as RoomSignal })
          break
      }
    }

    for (const name of EVENT_NAMES) {
      source.addEventListener(name, (event) => handle(name, event as MessageEvent<string>))
    }
  }

  private close(): void {
    this.source?.close()
    this.source = null
    this.connected = false
  }

  dispose(): void {
    this.listeners.clear()
    this.close()
  }

  isConnected(): boolean {
    return this.connected
  }
}

const channels = new Map<string, RoomChannel>()

export function getRoomChannel(roomId: string): RoomChannel {
  let channel = channels.get(roomId)
  if (!channel) {
    channel = new RoomChannel(roomId)
    channels.set(roomId, channel)
  }
  return channel
}

export function closeAllChannels(): void {
  for (const channel of channels.values()) channel.dispose()
  channels.clear()
}

export function isChannelConnected(roomId: string): boolean {
  return channels.get(roomId)?.isConnected() ?? false
}
