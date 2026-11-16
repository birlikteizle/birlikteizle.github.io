import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { networkInterfaces } from 'node:os'
import { loadConfig } from './env.mjs'
import { createStore } from './store.mjs'
import { createPresence } from './presence.mjs'
import {
  applyPlayback,
  addActivity,
  addMessage,
  createRoom,
  createUser,
  findUserByToken,
  getRoomSnapshot,
  isMember,
  joinRoom,
  RoomError,
} from './rooms.mjs'

const config = loadConfig()
const store = createStore(config.dataFile, { maxRoomAgeDays: config.maxRoomAgeDays })
const state = store.state

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'x-content-type-options': 'nosniff',
  })
  res.end(body)
}

function preflight(res) {
  res.writeHead(204, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, x-admin-token',
    'access-control-max-age': '86400',
  })
  res.end()
}

function readJson(req, limit = 64 * 1024) {
  return new Promise((resolvePromise, reject) => {
    let size = 0
    const chunks = []

    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new RoomError('BODY_TOO_LARGE', 'İstek gövdesi çok büyük.', 413))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (!raw) return resolvePromise({})
      try {
        const parsed = JSON.parse(raw)
        resolvePromise(parsed && typeof parsed === 'object' ? parsed : {})
      } catch {
        reject(new RoomError('INVALID_JSON', 'İstek gövdesi geçerli JSON değil.', 400))
      }
    })

    req.on('error', reject)
  })
}

function bearerToken(req) {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

function requireUser(req) {
  const user = findUserByToken(state, bearerToken(req))
  if (!user) throw new RoomError('UNAUTHORIZED', 'Oturum bulunamadı. Yeniden giriş yap.', 401)
  return user
}

function requireRoom(roomId, user) {
  const room = state.rooms[roomId]
  if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Oda bulunamadı.', 404)
  if (!isMember(room, user.uid)) {
    throw new RoomError('FORBIDDEN', 'Bu odanın üyesi değilsin.', 403)
  }
  return room
}

const rateBuckets = new Map()
function rateLimit(key, max, windowMs) {
  const now = Date.now()
  const bucket = rateBuckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  bucket.count += 1
  if (bucket.count > max) {
    throw new RoomError('RATE_LIMITED', 'Çok fazla istek. Biraz bekleyip tekrar dene.', 429)
  }
}

function clientIp(req) {
  return req.socket.remoteAddress || 'unknown'
}

/* ------------------------------------------------------------------ */
/* Çevrimiçi durum + SSE                                               */
/* ------------------------------------------------------------------ */

/** @type {Map<string, Set<{ res: import('node:http').ServerResponse, uid: string, name: string }>>} */
const streams = new Map()

const presence = createPresence({
  onChange(roomId, snapshot) {
    broadcast(roomId, 'presence', { presence: snapshot })
  },
})

function writeEvent(res, event, data) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  } catch {
    /* bağlantı kapanmış olabilir */
  }
}

function broadcast(roomId, event, data) {
  const clients = streams.get(roomId)
  if (!clients) return
  for (const client of clients) writeEvent(client.res, event, data)
}

/* ------------------------------------------------------------------ */
/* HTTP yönlendirme                                                    */
/* ------------------------------------------------------------------ */

async function handleApi(req, res, url) {
  const path = url.pathname
  const method = req.method || 'GET'

  if (method === 'GET' && path === '/api/health') {
    const activeRooms = Object.entries(state.rooms).filter(([roomId, room]) =>
      presence.hasOnline(roomId, room.members),
    ).length

    return sendJson(res, 200, {
      ok: true,
      serverTime: Date.now(),
      version: '2.0.0',
      rooms: { total: Object.keys(state.rooms).length, active: activeRooms },
    })
  }

  if (method === 'GET' && path === '/api/time') {
    return sendJson(res, 200, { now: Date.now() })
  }

  if (method === 'POST' && path === '/api/auth/register') {
    rateLimit(`register:${clientIp(req)}`, 12, 60_000)
    const body = await readJson(req)
    const result = createUser(state, body.displayName)
    store.save()
    return sendJson(res, 201, result)
  }

  if (method === 'GET' && path === '/api/auth/me') {
    const user = requireUser(req)
    return sendJson(res, 200, {
      user: {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL ?? null,
        email: user.email ?? null,
        providerData: [{ providerId: 'local' }],
      },
    })
  }

  if (method === 'POST' && path === '/api/rooms') {
    const user = requireUser(req)
    const body = await readJson(req)
    const source = body.source ?? null
    const roomId = createRoom(state, user, source, body.capacity, body.visibility)
    store.save()
    return sendJson(res, 201, { roomId })
  }

  const streamMatch = /^\/api\/rooms\/([A-Za-z0-9_-]{16,32})\/stream$/.exec(path)
  if (method === 'GET' && streamMatch) {
    const roomId = streamMatch[1]
    const token = url.searchParams.get('token') || bearerToken(req)
    const user = findUserByToken(state, token)
    if (!user) return sendJson(res, 401, { error: 'Oturum bulunamadı.', code: 'UNAUTHORIZED' })

    const room = state.rooms[roomId]
    if (!room) return sendJson(res, 404, { error: 'Oda bulunamadı.', code: 'ROOM_NOT_FOUND' })
    if (!isMember(room, user.uid)) {
      return sendJson(res, 403, { error: 'Bu odanın üyesi değilsin.', code: 'FORBIDDEN' })
    }

    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      'access-control-allow-origin': '*',
    })
    res.write('retry: 3000\n: bağlantı kuruldu\n\n')

    const client = { res, uid: user.uid, name: user.displayName }
    if (!streams.has(roomId)) streams.set(roomId, new Set())
    streams.get(roomId).add(client)

    presence.connect(roomId, user.uid, user.displayName)

    writeEvent(res, 'snapshot', getRoomSnapshot(state, roomId, presence.snapshot(roomId)))
    broadcast(roomId, 'presence', { presence: presence.snapshot(roomId) })

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n')
      } catch {
        /* kapanmış */
      }
    }, 25_000)
    heartbeat.unref?.()

    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      clearInterval(heartbeat)
      const set = streams.get(roomId)
      set?.delete(client)
      if (set && set.size === 0) streams.delete(roomId)

      const wentOffline = presence.disconnect(roomId, user.uid)
      if (wentOffline) {
        addActivity(state, { roomId, type: 'leave', user })
        store.save()
      }
      broadcast(roomId, 'presence', { presence: presence.snapshot(roomId) })
    }

    req.on('close', cleanup)
    req.on('error', cleanup)
    return
  }

  const roomMatch = /^\/api\/rooms\/([A-Za-z0-9_-]{16,32})(\/(join|playback|messages|ping|leave|signal))?$/.exec(
    path,
  )

  if (roomMatch) {
    const roomId = roomMatch[1]
    const action = roomMatch[3] ?? ''
    const user = requireUser(req)

    if (method === 'POST' && action === 'join') {
      const result = joinRoom(state, roomId, user)
      if (result.status === 'not-found') {
        throw new RoomError('ROOM_NOT_FOUND', 'Oda bulunamadı.', 404)
      }
      if (result.status === 'closed') {
        throw new RoomError('ROOM_CLOSED', 'Bu oda kapatılmış.', 410)
      }
      if (result.status === 'full') {
        const capacity = state.rooms[roomId]?.info?.capacity ?? 2
        throw new RoomError(
          'ROOM_FULL',
          `Oda dolu. Bu odanın kapasitesi ${capacity} kişi.`,
          409,
        )
      }
      if (result.status === 'invalid') {
        throw new RoomError('INVALID_ROOM', 'Oda bağlantısı geçersiz.', 400)
      }

      store.save()
      if (result.status === 'joined') {
        broadcast(roomId, 'members', { members: state.rooms[roomId].members })
      }
      return sendJson(res, 200, { status: result.status })
    }

    if (method === 'GET' && !action) {
      requireRoom(roomId, user)
      return sendJson(res, 200, getRoomSnapshot(state, roomId, presence.snapshot(roomId)))
    }

    if (method === 'POST' && action === 'playback') {
      requireRoom(roomId, user)
      const body = await readJson(req)
      const playback = applyPlayback(state, roomId, user, body)
      store.save()
      broadcast(roomId, 'playback', { playback, serverTime: Date.now() })
      return sendJson(res, 200, { playback })
    }

    if (method === 'POST' && action === 'messages') {
      requireRoom(roomId, user)
      const body = await readJson(req)
      const message = addMessage(state, roomId, user, body.text)
      store.save()
      broadcast(roomId, 'message', { message })
      return sendJson(res, 201, { message })
    }

    if (method === 'POST' && action === 'ping') {
      requireRoom(roomId, user)
      presence.touch(roomId, user.uid, user.displayName)
      return sendJson(res, 200, { ok: true, now: Date.now() })
    }

    // Ekran paylaşımı (WebRTC) el sıkışması ve gömülü sayfa sayacı gibi hafif
    // eşzamanlama mesajları. Sunucu içeriği yorumlamaz, odaya olduğu gibi iletir.
    if (method === 'POST' && action === 'signal') {
      requireRoom(roomId, user)
      rateLimit(`signal:${clientIp(req)}`, 400, 60_000)
      const body = await readJson(req)
      const type = String(body.type ?? '')
      if (!/^[a-z][a-z0-9-]{1,31}$/.test(type)) {
        throw new RoomError('INVALID_SIGNAL', 'Sinyal türü geçersiz.', 400)
      }

      const signal = { type, data: body.data ?? null, from: user.uid, at: Date.now() }
      broadcast(roomId, 'signal', signal)
      return sendJson(res, 202, { ok: true, at: signal.at })
    }

    if (method === 'POST' && action === 'leave') {
      const room = state.rooms[roomId]
      if (room && isMember(room, user.uid)) {
        const wasOnline = presence.markOffline(roomId, user.uid)
        if (wasOnline) {
          addActivity(state, { roomId, type: 'leave', user })
          store.save()
        }
        broadcast(roomId, 'presence', { presence: presence.snapshot(roomId) })
      }
      return sendJson(res, 200, { ok: true })
    }

    if (method === 'DELETE' && !action) {
      const room = requireRoom(roomId, user)
      if (room.info?.createdBy !== user.uid) {
        throw new RoomError('FORBIDDEN', 'Odayı yalnızca kuran kişi kapatabilir.', 403)
      }
      room.info.status = 'closed'
      store.save()
      broadcast(roomId, 'info', { info: room.info })
      return sendJson(res, 200, { ok: true })
    }
  }

  return sendJson(res, 404, { error: 'API yolu bulunamadı.', code: 'NOT_FOUND' })
}

async function serveStatic(req, res, url) {
  const method = req.method || 'GET'
  if (method !== 'GET' && method !== 'HEAD') {
    return sendJson(res, 405, { error: 'Yöntem desteklenmiyor.' })
  }

  const indexPath = join(config.publicDir, 'index.html')
  if (!existsSync(indexPath)) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(
      `<!doctype html><meta charset="utf-8"><title>Birlikte İzle</title>` +
        `<div style="font-family:system-ui;padding:40px;line-height:1.6">` +
        `<h1>Birlikte İzle sunucusu çalışıyor</h1>` +
        `<p>Arayüz derlemesi bulunamadı. Terminalde <code>npm run build</code> çalıştır, ` +
        `ardından bu sayfayı yenile.</p>` +
        `<p>Geliştirme modunda <code>npm run dev:all</code> kullanabilirsin.</p></div>`,
    )
    return
  }

  const pathname = decodeURIComponent(url.pathname)
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  let filePath = resolve(config.publicDir, relative)

  if (!filePath.startsWith(resolve(config.publicDir) + sep)) {
    return sendJson(res, 403, { error: 'Erişim reddedildi.' })
  }

  if (!existsSync(filePath)) {
    // SPA yönlendirmeleri (/room/...) için index.html
    if (!extname(relative)) filePath = indexPath
    else return sendJson(res, 404, { error: 'Dosya bulunamadı.' })
  }

  try {
    const data = await readFile(filePath)
    const ext = extname(filePath).toLowerCase()
    const isHtml = ext === '.html'
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'content-length': data.length,
      'cache-control': isHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    })
    res.end(method === 'HEAD' ? undefined : data)
  } catch {
    sendJson(res, 500, { error: 'Dosya okunamadı.' })
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost')

  if (req.method === 'OPTIONS') return preflight(res)

  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((error) => {
      if (res.headersSent) {
        res.end()
        return
      }
      if (error instanceof RoomError) {
        return sendJson(res, error.status ?? 400, { error: error.message, code: error.code })
      }
      console.error('[api] hata:', error)
      sendJson(res, 500, { error: 'Sunucu hatası.', code: 'INTERNAL' })
    })
    return
  }

  serveStatic(req, res, url).catch(() => {
    if (!res.headersSent) sendJson(res, 500, { error: 'Sunucu hatası.' })
  })
})

/* ------------------------------------------------------------------ */
/* Başlangıç                                                           */
/* ------------------------------------------------------------------ */

function lanAddresses() {
  const addresses = []
  for (const list of Object.values(networkInterfaces())) {
    for (const entry of list ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address)
    }
  }
  return addresses
}

server.listen(config.port, config.host, () => {
  const addresses = config.host === '0.0.0.0' ? ['localhost', ...lanAddresses()] : [config.host]
  console.log('')
  console.log('  🎬 Birlikte İzle sunucusu hazır')
  for (const address of addresses) {
    console.log(`     http://${address}:${config.port}`)
  }
  console.log('')
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\n  Sunucu kapatılıyor…')
    store.flush()
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2000).unref()
  })
}

process.on('uncaughtException', (error) => {
  console.error('[sunucu] yakalanmayan hata:', error)
  store.flush()
})
