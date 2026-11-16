/**
 * Oda bazlı çevrimiçi durum takibi. Bir kullanıcının birden fazla sekmesi
 * olabileceği için bağlantı sayısı tutulur; son sekme kapanınca çevrimdışı olur.
 */
const OFFLINE_GRACE_MS = 45_000

export function createPresence({ onChange } = {}) {
  /** @type {Map<string, Map<string, { sockets: number, lastSeen: number, displayName: string }>>} */
  const rooms = new Map()
  const timers = new Map()

  function roomMap(roomId) {
    let map = rooms.get(roomId)
    if (!map) {
      map = new Map()
      rooms.set(roomId, map)
    }
    return map
  }

  function notify(roomId) {
    if (!onChange) return
    if (timers.has(roomId)) return
    const timer = setTimeout(() => {
      timers.delete(roomId)
      onChange(roomId, snapshot(roomId))
    }, 120)
    timer.unref?.()
    timers.set(roomId, timer)
  }

  function connect(roomId, uid, displayName) {
    const map = roomMap(roomId)
    const entry = map.get(uid) ?? { sockets: 0, lastSeen: Date.now(), displayName }
    const wasOnline = isOnline(entry)
    entry.sockets += 1
    entry.lastSeen = Date.now()
    entry.displayName = displayName || entry.displayName
    map.set(uid, entry)
    notify(roomId)
    return !wasOnline
  }

  function disconnect(roomId, uid) {
    const map = rooms.get(roomId)
    const entry = map?.get(uid)
    if (!entry) return false

    entry.sockets = Math.max(0, entry.sockets - 1)
    entry.lastSeen = Date.now()
    notify(roomId)
    return entry.sockets === 0
  }

  function markOffline(roomId, uid) {
    const map = rooms.get(roomId)
    const entry = map?.get(uid)
    if (!entry) return false
    const wasOnline = isOnline(entry)
    entry.sockets = 0
    entry.lastSeen = Date.now()
    notify(roomId)
    return wasOnline
  }

  function touch(roomId, uid, displayName) {
    const map = roomMap(roomId)
    const entry = map.get(uid) ?? { sockets: 0, lastSeen: Date.now(), displayName }
    entry.lastSeen = Date.now()
    if (displayName) entry.displayName = displayName
    map.set(uid, entry)
    notify(roomId)
  }

  function isOnline(entry) {
    if (!entry) return false
    return entry.sockets > 0 || Date.now() - entry.lastSeen < OFFLINE_GRACE_MS
  }

  function snapshot(roomId) {
    const map = rooms.get(roomId)
    const result = {}
    if (!map) return result
    for (const [uid, entry] of map) {
      result[uid] = { online: isOnline(entry), lastSeen: entry.lastSeen }
    }
    return result
  }

  function onlineNames(roomId, members) {
    const map = rooms.get(roomId)
    const names = []
    for (const member of Object.values(members ?? {})) {
      if (member?.uid && isOnline(map?.get(member.uid))) names.push(member.displayName)
    }
    return names
  }

  function hasOnline(roomId, members) {
    return onlineNames(roomId, members).length > 0
  }

  function dropRoom(roomId) {
    rooms.delete(roomId)
  }

  return {
    connect,
    disconnect,
    markOffline,
    touch,
    snapshot,
    onlineNames,
    hasOnline,
    dropRoom,
    OFFLINE_GRACE_MS,
  }
}
