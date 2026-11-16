import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const MAX_ACTIVITY = 2000

function emptyState() {
  return {
    version: 1,
    users: {},
    rooms: {},
    activity: [],
  }
}

function normalizeState(raw) {
  const base = emptyState()
  if (!raw || typeof raw !== 'object') return base

  const state = {
    version: 1,
    users: raw.users && typeof raw.users === 'object' ? raw.users : {},
    rooms: raw.rooms && typeof raw.rooms === 'object' ? raw.rooms : {},
    activity: Array.isArray(raw.activity) ? raw.activity.slice(-MAX_ACTIVITY) : [],
  }

  for (const [roomId, room] of Object.entries(state.rooms)) {
    if (!room || typeof room !== 'object') {
      delete state.rooms[roomId]
      continue
    }
    room.info = room.info && typeof room.info === 'object' ? room.info : {}
    if (!Number.isFinite(Number(room.info.capacity)) || Number(room.info.capacity) < 2) {
      // Eski kayıtlarda kapasite yoktu; iki kişilik davranış korunur.
      room.info.capacity = 2
    }
    room.members = room.members && typeof room.members === 'object' ? room.members : {}
    room.messages = Array.isArray(room.messages) ? room.messages.slice(-300) : []
    if (!room.playback || typeof room.playback !== 'object') {
      room.playback = {
        sourceUrl: '',
        provider: 'none',
        videoId: '',
        status: 'idle',
        currentTime: 0,
        playbackRate: 1,
        updatedAt: Date.now(),
        updatedBy: '',
        commandId: 'init',
      }
    }
  }

  return state
}

/**
 * Küçük, dosya tabanlı durum deposu. Yazmalar 250 ms içinde birleştirilir;
 * süreç kapanırken `flush()` ile diske kesin olarak yazılır.
 */
export function createStore(file, { maxRoomAgeDays = 30 } = {}) {
  let state = emptyState()
  let timer = null

  if (existsSync(file)) {
    try {
      state = normalizeState(JSON.parse(readFileSync(file, 'utf8')))
    } catch (error) {
      console.error('[store] Durum dosyası okunamadı, boş durumla başlanıyor:', error.message)
    }
  }

  const cutoff = Date.now() - maxRoomAgeDays * 24 * 60 * 60 * 1000
  for (const [roomId, room] of Object.entries(state.rooms)) {
    const lastSeen = Number(room.playback?.updatedAt) || Number(room.info?.createdAt) || 0
    if (lastSeen && lastSeen < cutoff) delete state.rooms[roomId]
  }

  function flush() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    try {
      mkdirSync(dirname(file), { recursive: true })
      const temporary = `${file}.tmp`
      writeFileSync(temporary, JSON.stringify(state), 'utf8')
      renameSync(temporary, file)
    } catch (error) {
      console.error('[store] Durum yazılamadı:', error.message)
    }
  }

  function save() {
    if (timer) return
    timer = setTimeout(flush, 250)
    timer.unref?.()
  }

  return {
    get state() {
      return state
    },
    save,
    flush,
  }
}
