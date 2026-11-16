import type { ChatMessage, PlaybackState, RoomMember } from '@/types'
import { joinRoom, type MessageAction, type Room } from 'trystero'
import { normalizeCapacity } from '@/lib/capacity'
import { readRoomMetaFromLocation } from '@/lib/roomLink'
import { readRoomCapacityFromLocation } from '@/lib/roomLink'

const APP_ID = 'birlikte-izle-p2p-v1'
const HISTORY_LIMIT = 12
const HISTORY_BATCH = 2

/**
 * Sinyalleşme için herkese açık Nostr relay'leri (Trystero'nun kendi listesi).
 * Eşler birbirini bu relay'ler üzerinden bulur; oda verisi relay'den geçmez,
 * doğrudan WebRTC kanalına taşınır. Sorunlu relay'ler otomatik atlanır.
 */

/**
 * Doğrudan bağlantı için ICE sunucuları. TURN ayarları ortam değişkenlerinden
 * gelir; simetrik NAT arkasındaki ağlarda TURN olmadan bağlantı kurulamaz.
 */
function buildIceServers(): RTCIceServer[] {
  const env = import.meta.env
  const servers: RTCIceServer[] = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun.cloudflare.com:3478',
      ],
    },
  ]

  if (env.VITE_TURN_URL) {
    servers.push({
      urls: env.VITE_TURN_URL,
      username: env.VITE_TURN_USERNAME || undefined,
      credential: env.VITE_TURN_CREDENTIAL || undefined,
    })
  }

  return servers
}

/** Trystero hatalarını kullanıcının anlayacağı mesajlara çevirir. */
function friendlyError(code: string, fallback: string): string {
  switch (code) {
    case 'peer-connect-failed':
      return (
        'Karşı tarafa doğrudan bağlantı kurulamadı. Ağ kısıtlaması (kurumsal güvenlik duvarı, ' +
        'simetrik NAT) olabilir. Farklı bir ağda deneyin veya VITE_TURN_URL ile bir TURN sunucusu tanımlayın.'
      )
    case 'room-full':
      return 'Oda dolu. Kapasiteyi artırmak için odayı daha yüksek kişi sayısıyla yeniden oluştur.'
    case 'relay-failed':
      return 'Eşleşme sunucularına ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.'
    case 'identity-failed':
      return 'Tarayıcı kimliği oluşturulamadı. Gizli mod kullanıyorsan normal sekmede dene.'
    case 'decrypt-failed':
    case 'handshake-failed':
      return 'Eşleşme doğrulanamadı. Her iki taraf da aynı bağlantıyı kullanmalı; sayfayı yenileyip tekrar dene.'
    default:
      return fallback
  }
}

/* ------------------------------------------------------------------ */
/* Tel üzerindeki mesaj biçimi                                         */
/* ------------------------------------------------------------------ */

export interface HelloPayload {
  member: RoomMember
}

type Wire =
  | { t: 'hi'; hello: HelloPayload }
  | { t: 'st'; playback: PlaybackState; from: string }
  | { t: 'msg'; message: ChatMessage }
  | { t: 'hist'; messages: ChatMessage[] }
  | { t: 'vs'; uid: string; name: string; mic: boolean; cam: boolean }
  | { t: 'scr'; sharing: boolean; name: string }
  | { t: 'bye'; uid: string }

export type P2PEvent =
  | { type: 'hello'; hello: HelloPayload; peerId: string }
  | { type: 'state'; playback: PlaybackState; from: string }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'history'; messages: ChatMessage[] }
  | { type: 'voice-stream'; stream: MediaStream; peerId: string; video: boolean }
  | { type: 'voice-gone'; peerId: string }
  | { type: 'screen-state'; sharing: boolean; name: string; peerId: string }
  | { type: 'voice-state'; uid: string; name: string; mic: boolean; cam: boolean }
  | { type: 'bye'; uid: string }
  | { type: 'peers'; peerIds: string[] }
  | { type: 'stream'; stream: MediaStream; peerId: string }
  | { type: 'full' }
  | { type: 'error'; message: string }

type Listener = (event: P2PEvent) => void

/**
 * Sunucusuz oda taşıyıcısı.
 *
 * Sinyalleşme Trystero üzerinden herkese açık Nostr relay'leriyle yapılır; oda
 * verisi (oynatma, sohbet) doğrudan tarayıcılar arasındaki WebRTC kanalından
 * geçer. Sunucu ve kalıcı depo yoktur: iki taraf da çıktığında oda biter.
 */
class P2PRoom {
  readonly roomId: string
  readonly capacity: number
  /** Odanın yöneticisi (davet bağlantısından gelir). Boşsa kısıt uygulanmaz. */
  readonly adminUid: string
  private room: Room
  private action: MessageAction<Wire>
  private listeners = new Set<Listener>()
  private unsubs: Array<() => void> = []
  private localStream: MediaStream | null = null
  private voiceStream: MediaStream | null = null
  private destroyed = false

  constructor(roomId: string, capacity: number) {
    this.roomId = roomId
    this.capacity = capacity
    this.adminUid = readRoomMetaFromLocation().adminUid
    this.room = joinRoom(
      {
        appId: APP_ID,
        maxUsers: capacity,
        rtcConfig: { iceServers: buildIceServers() },
      },
      roomId,
    )
    this.action = this.room.makeAction<Wire>('m')

    this.unsubs.push(
      this.action.onMessage((data, context) => {
        this.handleWire(data, context.peerId)
      }),
      this.room.onPeerJoin(() => this.emitPeers()),
      this.room.onPeerLeave((context) => {
        this.emitPeers()
        this.emit({ type: 'voice-gone', peerId: context.peerId })
      }),
      this.room.onPeerStream((stream, context) => {
        // Akışlar metadata ile ayrılır: sesli sohbet mi, ekran paylaşımı mı?
        const meta = context.metadata as { voice?: boolean; video?: boolean } | undefined
        if (meta?.voice) {
          this.emit({
            type: 'voice-stream',
            stream,
            peerId: context.peerId,
            video: Boolean(meta.video),
          })
          return
        }
        this.emit({ type: 'stream', stream, peerId: context.peerId })
      }),
      this.room.onError((error) => {
        if (error.code === 'room-full') {
          this.emit({ type: 'full' })
          return
        }
        this.emit({ type: 'error', message: friendlyError(error.code, error.message) })
      }),
    )
  }

  private handleWire(data: Wire, peerId: string): void {
    switch (data?.t) {
      case 'hi':
        this.emit({ type: 'hello', hello: data.hello, peerId })
        break
      case 'st':
        this.emit({ type: 'state', playback: data.playback, from: data.from })
        break
      case 'msg':
        this.emit({ type: 'chat', message: data.message })
        break
      case 'hist':
        this.emit({ type: 'history', messages: data.messages })
        break
      case 'vs':
        this.emit({
          type: 'voice-state',
          uid: data.uid,
          name: data.name,
          mic: data.mic,
          cam: data.cam,
        })
        break
      case 'scr':
        this.emit({
          type: 'screen-state',
          sharing: data.sharing,
          name: data.name,
          peerId,
        })
        break
      case 'bye':
        this.emit({ type: 'bye', uid: data.uid })
        break
    }
  }

  private emit(event: P2PEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        console.error('[p2p] dinleyici hatası:', error)
      }
    }
  }

  private emitPeers(): void {
    this.emit({ type: 'peers', peerIds: Object.keys(this.room.getPeers()) })
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener({ type: 'peers', peerIds: Object.keys(this.room.getPeers()) })
    return () => {
      this.listeners.delete(listener)
    }
  }

  peerCount(): number {
    return Object.keys(this.room.getPeers()).length
  }

  sendHello(hello: HelloPayload): void {
    void this.action.send({ t: 'hi', hello }).catch(() => undefined)
  }
  sendState(playback: PlaybackState, from: string): void {
    void this.action.send({ t: 'st', playback, from }).catch(() => undefined)
  }

  sendChat(message: ChatMessage): void {
    // Gönderen kendi mesajını anında görsün diye yerel yayın da yapılır.
    this.emit({ type: 'chat', message })
    void this.action.send({ t: 'msg', message }).catch(() => undefined)
  }

  sendHistory(messages: ChatMessage[]): void {
    const recent = messages.slice(-HISTORY_LIMIT)
    for (let index = 0; index < recent.length; index += HISTORY_BATCH) {
      void this.action
        .send({ t: 'hist', messages: recent.slice(index, index + HISTORY_BATCH) })
        .catch(() => undefined)
    }
  }

  sendBye(uid: string): void {
    void this.action.send({ t: 'bye', uid }).catch(() => undefined)
  }

  async addStream(stream: MediaStream): Promise<void> {
    this.localStream = stream
    await this.room.addStream(stream, { metadata: { voice: false } })
  }

  /** Sesli sohbet akışını paylaşır (ekran paylaşımından ayrı etiketlenir). */
  async addVoiceStream(stream: MediaStream, video = false): Promise<void> {
    this.voiceStream = stream
    await this.room.addStream(stream, { metadata: { voice: true, video } })
  }

  /** Belirtilen akışı yayından çıkarır (ses ve görüntü ayrı yayınlanabilsin). */
  removeVoiceStream(stream?: MediaStream): void {
    const target = stream ?? this.voiceStream
    if (stream && this.voiceStream === stream) this.voiceStream = null
    else if (!stream) this.voiceStream = null
    if (target) this.room.removeStream(target)
  }

  /** Mikrofon/kamera durumunu odaya duyurur. */
  sendVoiceState(uid: string, name: string, mic: boolean, cam: boolean): void {
    void this.action.send({ t: 'vs', uid, name, mic, cam }).catch(() => undefined)
  }

  /** Ekran paylaşımının başladığını/bitiğini duyurur. */
  sendScreenState(sharing: boolean, name: string): void {
    void this.action.send({ t: 'scr', sharing, name }).catch(() => undefined)
  }

  /** Sesli sohbetten ayrıldığımızı duyurur. */
  sendVoiceLeave(uid: string): void {
    this.sendVoiceState(uid, '', false, false)
  }

  removeStream(): void {
    const stream = this.localStream
    this.localStream = null
    if (stream) this.room.removeStream(stream)
  }

  /** Kamera değiştirirken mevcut video kanalını yenisiyle değiştirir. */
  async replaceVideoTrack(oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack): Promise<void> {
    await this.room.replaceTrack(oldTrack, newTrack)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    for (const unsubscribe of this.unsubs) unsubscribe()
    this.unsubs = []
    this.removeStream()
    this.removeVoiceStream()
    void this.room.leave().catch(() => undefined)
    this.listeners.clear()
  }
}

/* ------------------------------------------------------------------ */
/* Oda havuzu                                                          */
/* ------------------------------------------------------------------ */

interface Entry {
  room: P2PRoom
  refs: number
  closeTimer: number | null
}

const entries = new Map<string, Entry>()

export function getP2PRoom(
  roomId: string,
  capacity: number = readRoomCapacityFromLocation(),
): P2PRoom {
  const existing = entries.get(roomId)
  if (existing) {
    if (existing.closeTimer !== null) {
      window.clearTimeout(existing.closeTimer)
      existing.closeTimer = null
    }
    return existing.room
  }

  const room = new P2PRoom(roomId, normalizeCapacity(capacity))
  entries.set(roomId, { room, refs: 0, closeTimer: null })
  return room
}

/**
 * Odaya bir referans ekler. React StrictMode'un hızlı mount/unmount döngüsünde
 * bağlantının gereksiz yere kopmaması için son referans bırakıldığında kısa bir
 * bekleme sonrası kapatılır.
 *
 * Kapasite verilmezse davet bağlantısındaki `?k=` değeri kullanılır; böylece
 * odadaki herkes aynı sınırla bağlanır.
 */
export function retainP2PRoom(
  roomId: string,
  capacity: number = readRoomCapacityFromLocation(),
): { room: P2PRoom; release: () => void } {
  const room = getP2PRoom(roomId, capacity)
  const entry = entries.get(roomId)
  if (entry) entry.refs += 1

  let released = false
  return {
    room,
    release: () => {
      if (released) return
      released = true
      const current = entries.get(roomId)
      if (!current) return
      current.refs = Math.max(0, current.refs - 1)
      if (current.refs > 0) return
      current.closeTimer = window.setTimeout(() => {
        const latest = entries.get(roomId)
        if (!latest || latest.refs > 0) return
        latest.room.destroy()
        entries.delete(roomId)
      }, 1500)
    },
  }
}

/* ------------------------------------------------------------------ */
/* Sunucusuz mod yardimcilari (saf, test edilebilir)                   */
/* ------------------------------------------------------------------ */

export {
  buildInitialPlayback,
  createRoomId,
  selfMember,
  stashInitialSource,
  takeInitialSource,
  withMember,
  ROOM_ID_LENGTH,
  type InitialSource,
} from '@/lib/p2p/local'

