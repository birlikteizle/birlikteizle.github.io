import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'

const ROOM_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const MAX_MESSAGES = 300
const MAX_ACTIVITY = 2000
const VALID_PROVIDERS = new Set(['youtube', 'vimeo', 'html5', 'hls', 'iframe'])
const VALID_STATUSES = new Set(['playing', 'paused', 'idle'])

/** Oda kapasitesi sınırları. */
const MIN_CAPACITY = 2
const MAX_CAPACITY = 50
const DEFAULT_CAPACITY = 2

export function normalizeCapacity(value, fallback = DEFAULT_CAPACITY) {
  const parsed = Math.floor(Number(value))
  if (!Number.isFinite(parsed)) return fallback
  if (parsed < MIN_CAPACITY) return MIN_CAPACITY
  return Math.min(MAX_CAPACITY, parsed)
}

/** Oda görünürlüğü: yalnızca 'public' odalar listelenebilir. */
export function normalizeVisibility(value) {
  return value === 'private' ? 'private' : 'public'
}

export class RoomError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

function randomId(length) {
  const bytes = randomBytes(length)
  let id = ''
  for (const byte of bytes) {
    id += ROOM_ID_ALPHABET[byte % ROOM_ID_ALPHABET.length]
  }
  return id
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function sanitizeDisplayName(raw) {
  return String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
}

export function sanitizeMessage(raw) {
  return String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, 2000)
}

export function publicUser(record) {
  return {
    uid: record.uid,
    displayName: record.displayName,
    photoURL: record.photoURL ?? null,
    email: record.email ?? null,
    providerData: [{ providerId: 'local' }],
  }
}

export function createUser(state, displayName) {
  const name = sanitizeDisplayName(displayName)
  if (name.length < 1) {
    throw new RoomError('INVALID_NAME', 'Lütfen en az 1 karakterlik bir ad gir.')
  }

  const uid = randomUUID()
  const token = randomBytes(32).toString('base64url')
  const record = {
    uid,
    displayName: name,
    photoURL: null,
    email: null,
    tokenHash: hashToken(token),
    createdAt: Date.now(),
  }

  state.users[uid] = record
  return { user: publicUser(record), token }
}

export function findUserByToken(state, token) {
  if (typeof token !== 'string' || token.length < 16) return null
  const hash = Buffer.from(hashToken(token), 'hex')

  for (const record of Object.values(state.users)) {
    if (typeof record?.tokenHash !== 'string') continue
    const candidate = Buffer.from(record.tokenHash, 'hex')
    if (candidate.length !== hash.length) continue
    if (timingSafeEqual(candidate, hash)) return record
  }

  return null
}

export function roomCode(roomId) {
  return roomId.slice(0, 6).toUpperCase()
}

export function isMember(room, uid) {
  return Object.values(room.members ?? {}).some((member) => member?.uid === uid)
}

function memberSlot(room, uid) {
  return Object.keys(room.members ?? {}).find((slot) => room.members[slot]?.uid === uid) ?? null
}

function memberOf(user) {
  return {
    uid: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL ?? null,
    joinedAt: Date.now(),
  }
}

export function addActivity(state, { roomId, type, user, detail = '' }) {
  state.activity.push({
    at: Date.now(),
    roomId,
    type,
    uid: user?.uid ?? '',
    name: user?.displayName ?? 'Kullanıcı',
    detail: String(detail).slice(0, 160),
  })
  if (state.activity.length > MAX_ACTIVITY) {
    state.activity.splice(0, state.activity.length - MAX_ACTIVITY)
  }
}

function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname.includes('.'))
  } catch {
    return false
  }
}

/**
 * İstemcinin ürettiği kanonik kaynağı sunucu tarafında da doğrular. Kurallar
 * istemciye güvenmeden uygulanır; rastgele URL'ler video olarak kabul edilmez.
 */
export function normalizeSource(input) {
  if (!input || typeof input !== 'object') {
    return { sourceUrl: '', provider: 'none', videoId: '' }
  }

  const provider = input.provider
  if (provider === 'none' || provider === undefined) {
    return { sourceUrl: '', provider: 'none', videoId: '' }
  }

  if (!VALID_PROVIDERS.has(provider)) {
    throw new RoomError('INVALID_SOURCE', 'Desteklenmeyen video sağlayıcısı.')
  }

  const sourceUrl = String(input.sourceUrl ?? '')
  const videoId = String(input.videoId ?? '')

  if (!sourceUrl || sourceUrl.length > 2048 || !isHttpUrl(sourceUrl)) {
    throw new RoomError('INVALID_SOURCE', 'Video bağlantısı geçerli bir https adresi olmalı.')
  }

  if (provider === 'youtube') {
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      throw new RoomError('INVALID_SOURCE', 'YouTube video kimliği geçersiz.')
    }
  } else if (provider === 'vimeo') {
    if (!/^\d{5,12}$/.test(videoId)) {
      throw new RoomError('INVALID_SOURCE', 'Vimeo video kimliği geçersiz.')
    }
  } else if (provider === 'iframe') {
    // Gömülü sayfa: uzantı aranmaz, yalnızca https adresi olması yeterlidir.
    if (videoId !== '') {
      throw new RoomError('INVALID_SOURCE', 'Gömülü sayfa kaynağında video kimliği olmamalı.')
    }
  } else {
    const path = new URL(sourceUrl).pathname.toLowerCase()
    const extension = path.slice(path.lastIndexOf('.') + 1)
    const allowed = provider === 'hls' ? ['m3u8'] : ['mp4', 'webm', 'ogg', 'ogv', 'm4v']
    if (!allowed.includes(extension)) {
      throw new RoomError('INVALID_SOURCE', `Bu bağlantı .${allowed.join(' / .')} uzantılı değil.`)
    }
  }

  return { sourceUrl, provider, videoId }
}

export function createRoom(state, user, source, capacity, visibility) {
  const normalized = normalizeSource({
    provider: source?.provider,
    sourceUrl: source?.url,
    videoId: source?.videoId,
  })
  const roomId = randomId(22)
  const now = Date.now()

  state.rooms[roomId] = {
    info: {
      createdBy: user.uid,
      createdAt: now,
      status: 'active',
      capacity: normalizeCapacity(capacity),
      visibility: normalizeVisibility(visibility),
    },
    members: { s0: { ...memberOf(user), joinedAt: now } },
    playback: {
      ...normalized,
      status: normalized.provider === 'none' ? 'idle' : 'paused',
      currentTime: normalized.provider === 'none' ? 0 : Math.max(0, Number(source?.startAt) || 0),
      playbackRate: 1,
      updatedAt: now,
      updatedBy: user.uid,
      commandId: randomUUID(),
    },
    messages: [],
  }

  addActivity(state, { roomId, type: 'join', user })
  return roomId
}

export function joinRoom(state, roomId, user) {
  if (!/^[A-Za-z0-9_-]{16,32}$/.test(roomId)) return { status: 'invalid' }

  const room = state.rooms[roomId]
  if (!room) return { status: 'not-found' }
  if (room.info?.status !== 'active') return { status: 'closed' }

  const slot = memberSlot(room, user.uid)
  if (slot) {
    const existing = room.members[slot]
    if (existing.displayName !== user.displayName || existing.photoURL !== user.photoURL) {
      room.members[slot] = { ...existing, displayName: user.displayName, photoURL: user.photoURL }
    }
    return { status: 'already-member' }
  }

  const capacity = normalizeCapacity(room.info?.capacity)
  room.info.capacity = capacity

  const used = Object.keys(room.members).length
  if (used >= capacity) return { status: 'full' }

  // Boş slot bul (s0, s1, s2 ...); silinen slotlar yeniden kullanılır.
  let index = 0
  while (room.members[`s${index}`]) index += 1
  room.members[`s${index}`] = memberOf(user)

  addActivity(state, { roomId, type: 'join', user })
  return { status: 'joined' }
}

export function getRoomSnapshot(state, roomId, presenceSnapshot) {
  const room = state.rooms[roomId]
  if (!room) return null

  return {
    serverTime: Date.now(),
    info: room.info,
    members: room.members,
    playback: room.playback,
    presence: presenceSnapshot,
    messages: room.messages.slice(-200),
  }
}

function estimateExpectedTime(playback, now) {
  if (playback.status !== 'playing') return playback.currentTime
  return playback.currentTime + ((now - playback.updatedAt) / 1000) * playback.playbackRate
}

export function applyPlayback(state, roomId, user, command) {
  const room = state.rooms[roomId]
  if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Oda bulunamadı.', 404)
  const status = String(command.status ?? '')
  if (!VALID_STATUSES.has(status)) {
    throw new RoomError('INVALID_COMMAND', 'Geçersiz oynatma durumu.')
  }

  const currentTime = Number(command.currentTime)
  if (!Number.isFinite(currentTime) || currentTime < 0 || currentTime > 86400) {
    throw new RoomError('INVALID_COMMAND', 'Geçersiz zaman değeri.')
  }

  const playbackRate = Number(command.playbackRate)
  if (!Number.isFinite(playbackRate) || playbackRate < 0.25 || playbackRate > 4) {
    throw new RoomError('INVALID_COMMAND', 'Oynatma hızı 0.25× ile 4× arasında olmalı.')
  }

  const commandId = String(command.commandId ?? '').slice(0, 128)
  if (!commandId) throw new RoomError('INVALID_COMMAND', 'Komut kimliği eksik.')

  const previous = room.playback
  const now = Date.now()
  const hasSourceUpdate = command.sourceUrl !== undefined || command.provider !== undefined

  const source = hasSourceUpdate
    ? normalizeSource(command)
    : {
        sourceUrl: previous.sourceUrl,
        provider: previous.provider,
        videoId: previous.videoId,
      }

  if (status !== 'idle' && source.provider === 'none') {
    throw new RoomError('INVALID_COMMAND', 'Önce bir video eklenmeli.')
  }

  let type = null
  if (source.sourceUrl !== previous.sourceUrl) type = 'source'
  else if (playbackRate !== previous.playbackRate) type = 'rate'
  else if (status !== previous.status) type = status === 'playing' ? 'play' : 'pause'
  else if (Math.abs(currentTime - estimateExpectedTime(previous, now)) > 1.5) type = 'seek'

  room.playback = {
    ...source,
    status,
    currentTime: Math.min(86400, Math.max(0, currentTime)),
    playbackRate,
    updatedAt: now,
    updatedBy: user.uid,
    commandId,
  }

  if (type) addActivity(state, { roomId, type, user })

  return room.playback
}

export function addMessage(state, roomId, user, rawText) {
  const room = state.rooms[roomId]
  if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Oda bulunamadı.', 404)

  const text = sanitizeMessage(rawText)
  if (!text) throw new RoomError('EMPTY_MESSAGE', 'Boş mesaj gönderilemez.')

  const message = {
    id: randomUUID(),
    senderId: user.uid,
    senderName: user.displayName.slice(0, 64),
    photoURL: user.photoURL ?? null,
    text,
    createdAt: Date.now(),
  }

  room.messages.push(message)
  if (room.messages.length > MAX_MESSAGES) {
    room.messages.splice(0, room.messages.length - MAX_MESSAGES)
  }

  addActivity(state, { roomId, type: 'message', user })
  return message
}

export function sourceLabel(playback) {
  const provider = playback?.provider ?? 'none'
  if (provider === 'none' || !playback?.sourceUrl) return 'Video yok'

  if (provider === 'youtube') return `YouTube · ${playback.videoId}`
  if (provider === 'vimeo') return `Vimeo · ${playback.videoId}`

  try {
    const url = new URL(playback.sourceUrl)
    if (provider === 'iframe') {
      return `Gömülü sayfa · ${url.hostname.replace(/^www\./, '')}`
    }
    const file = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? url.hostname)
    return `${provider === 'hls' ? 'HLS' : 'Video'} · ${file.slice(0, 60)}`
  } catch {
    return provider === 'hls' ? 'HLS' : 'Video'
  }
}

export { MAX_MESSAGES }
