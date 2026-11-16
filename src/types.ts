export type VideoProvider = 'youtube' | 'vimeo' | 'html5' | 'hls' | 'iframe' | 'none'

export type PlaybackStatus = 'playing' | 'paused' | 'idle'

export interface PlaybackState {
  /** Kullanıcının yapıştırdığı orijinal bağlantı. Video yoksa boş dizedir. */
  sourceUrl: string
  provider: VideoProvider
  /** YouTube / Vimeo kimliği. Doğrudan dosyalarda boş dizedir. */
  videoId: string
  status: PlaybackStatus
  currentTime: number
  playbackRate: number
  /** Sunucu zaman damgası (ms). */
  updatedAt: number
  updatedBy: string
  commandId: string
}

export interface RoomInfo {
  createdBy: string
  createdAt: number
  status: 'active'
  /** Odanın alabileceği en fazla kişi sayısı. */
  capacity: number
  /** Herkese açık odalar (ileride) listelenebilir; özel odalar listelenmez. */
  visibility: RoomVisibility
  /** Yöneticinin yetki verdiği kişiler (oynatmayı onlar da yönetebilir). */
  managers: string[]
}

export type RoomVisibility = 'public' | 'private'

export interface RoomMember {
  uid: string
  displayName: string
  photoURL: string | null
  joinedAt: number
}

export type RoomMembers = Record<string, RoomMember>

export interface RoomPresence {
  online: boolean
  lastSeen: number
}

export type RoomPresenceMap = Record<string, RoomPresence>

export interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  photoURL: string | null
  text: string
  createdAt: number | null
}

export interface VideoSource {
  provider: Exclude<VideoProvider, 'none'>
  url: string
  videoId: string
  /** Videonun başlangıç saniyesi (YouTube `t` parametresi gibi). */
  startAt: number
}

export interface RoomMeta {
  info: RoomInfo
  members: RoomMembers
  presence: RoomPresenceMap
  playback: PlaybackState
}

/** Sunucu tarafından verilen yerel oturum kullanıcısı (Firebase Auth gerekmez). */
export interface AppUser {
  uid: string
  displayName: string
  photoURL: string | null
  email: string | null
  providerData: Array<{ providerId: string }>
}

export interface RoomSnapshot {
  serverTime: number
  info: RoomInfo
  members: RoomMembers
  playback: PlaybackState
  presence: RoomPresenceMap
  messages: ChatMessage[]
}

export type PlayerStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Oda içindeki hafif eşzamanlama mesajı. Oynatıcıdan bağımsız sinyaller
 * (gömülü sayfa sayacı, ekran paylaşımı WebRTC el sıkışması) bu kanaldan geçer.
 */
export interface RoomSignal {
  /** Örnek: 'countdown', 'rtc-offer', 'rtc-answer', 'rtc-ice', 'screen-start', 'screen-stop' */
  type: string
  /** Sinyale özel veri (SDP, ICE adayı, sayaç süresi...). */
  data: unknown
  /** Sinyali gönderen kullanıcının kimliği. */
  from: string
  at: number
}
