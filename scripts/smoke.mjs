/**
 * Uçtan uca duman testi: iki kullanıcı, oda, senkron komut, sohbet ve SSE.
 * Kullanım: sunucu çalışırken `node scripts/smoke.mjs`
 */
const base = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '')

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = { accept: 'application/json' }
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let data = null
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status}: ${JSON.stringify(data)}`)
  }
  return data
}

function assert(condition, message) {
  if (!condition) throw new Error(`Doğrulama başarısız: ${message}`)
}

async function readSseUntil(roomId, token, marker, timeoutMs = 5000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let buffer = ''

  try {
    const response = await fetch(
      `${base}/api/rooms/${roomId}/stream?token=${encodeURIComponent(token)}`,
      { signal: controller.signal },
    )
    assert(response.status === 200, `SSE durumu 200 olmalı, gelen: ${response.status}`)

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (!buffer.includes(marker)) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
    }

    reader.cancel().catch(() => undefined)
  } catch (error) {
    if (error.name !== 'AbortError') throw error
  } finally {
    clearTimeout(timer)
  }

  return buffer
}

const readSse = (roomId, token, timeoutMs = 3000) =>
  readSseUntil(roomId, token, 'event: snapshot', timeoutMs)

const steps = []
const step = (name, detail = '') => steps.push({ name, detail })

const health = await call('/api/health')
assert(health.ok === true, 'health ok dönmeli')
step('Sağlık', `sürüm ${health.version}`)

const ali = await call('/api/auth/register', { method: 'POST', body: { displayName: 'Ali' } })
const ayse = await call('/api/auth/register', { method: 'POST', body: { displayName: 'Ayşe' } })
assert(ali.token && ayse.token, 'iki kullanıcı da token almalı')
step('Kayıt', `${ali.user.displayName} + ${ayse.user.displayName}`)

const { roomId } = await call('/api/rooms', {
  method: 'POST',
  token: ali.token,
  body: {
    source: {
      provider: 'youtube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
      startAt: 0,
    },
  },
})
assert(/^[A-Za-z0-9_-]{16,32}$/.test(roomId), 'oda kimliği geçerli olmalı')
step('Oda oluşturma', roomId)

const joined = await call(`/api/rooms/${roomId}/join`, { method: 'POST', token: ayse.token, body: {} })
assert(joined.status === 'joined', 'ikinci kullanıcı odaya katılmalı')
step('Katılma', joined.status)

const playback = await call(`/api/rooms/${roomId}/playback`, {
  method: 'POST',
  token: ayse.token,
  body: { status: 'playing', currentTime: 42.5, playbackRate: 1, commandId: `smoke-${Date.now()}` },
})
assert(playback.playback.status === 'playing', 'oynatma durumu playing olmalı')
assert(playback.playback.updatedBy === ayse.user.uid, 'komutu gönderen kullanıcı yazılmalı')
step('Oynatma komutu', `${playback.playback.currentTime}s · ${playback.playback.status}`)

const message = await call(`/api/rooms/${roomId}/messages`, {
  method: 'POST',
  token: ayse.token,
  body: { text: 'hazırım 🍿' },
})
assert(message.message.text === 'hazırım 🍿', 'mesaj kaydedilmeli')
step('Sohbet', message.message.text)

const snapshot = await call(`/api/rooms/${roomId}`, { token: ali.token })
assert(Object.keys(snapshot.members).length === 2, 'odada iki üye olmalı')
assert(snapshot.messages.length >= 1, 'geçmiş mesajlar gelmeli')
step('Oda anlık görüntüsü', `${Object.keys(snapshot.members).length} üye · ${snapshot.messages.length} mesaj`)

const sse = await readSse(roomId, ali.token)
assert(sse.includes('event: snapshot'), 'SSE snapshot olayı göndermeli')
assert(sse.includes('"playback"'), 'snapshot oynatma durumunu içermeli')
step('SSE akışı', `${sse.length} bayt`)

const third = await call('/api/auth/register', { method: 'POST', body: { displayName: 'Üçüncü' } })
const fullResponse = await fetch(`${base}/api/rooms/${roomId}/join`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${third.token}` },
  body: '{}',
})
assert(fullResponse.status === 409, `üçüncü kişi 409 almalı, gelen: ${fullResponse.status}`)
step('Oda kapasitesi', '2 kişilik oda: 409 ROOM_FULL')

// Kapasite ayarı: 3 kişilik oda üçüncüyü kabul eder, dördüncüyü reddeder
const room3 = await call('/api/rooms', {
  method: 'POST',
  token: ali.token,
  body: { capacity: 3 },
})
const joinTwo = await call(`/api/rooms/${room3.roomId}/join`, {
  method: 'POST',
  token: ayse.token,
  body: {},
})
const joinThree = await call(`/api/rooms/${room3.roomId}/join`, {
  method: 'POST',
  token: third.token,
  body: {},
})
assert(joinTwo.status === 'joined' && joinThree.status === 'joined', 'ilk üç kişi katılmalı')

const fourth = await call('/api/auth/register', { method: 'POST', body: { displayName: 'Dördüncü' } })
const denied = await fetch(`${base}/api/rooms/${room3.roomId}/join`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${fourth.token}` },
  body: '{}',
})
assert(denied.status === 409, `dördüncü kişi 409 almalı, gelen: ${denied.status}`)

const capacitySnapshot = await call(`/api/rooms/${room3.roomId}`, { token: ali.token })
assert(capacitySnapshot.info.capacity === 3, 'kapasite oda bilgisinde dönmeli')
assert(
  Object.keys(capacitySnapshot.members).length === 3,
  'odada üç üye bulunmalı',
)
step('Ayarlanabilir kapasite', `3 kişilik oda: 3 kabul, 4. kişi reddedildi`)

// Gömülü sayfa (iframe) kaynağı: "her siteden izleme" desteği
const embedRoom = await call('/api/rooms', {
  method: 'POST',
  token: ali.token,
  body: {
    source: {
      provider: 'iframe',
      url: 'https://archive.org/details/some-film',
      videoId: '',
      startAt: 0,
    },
  },
})
const embedSnapshot = await call(`/api/rooms/${embedRoom.roomId}`, { token: ali.token })
assert(embedSnapshot.playback.provider === 'iframe', 'kaynak iframe olarak kaydedilmeli')
step('Gömülü sayfa kaynağı', 'iframe kabul edildi')

// Sinyal kanalı: ekran paylaşımı el sıkışması ve gömülü sayfa sayacı bunu kullanır
const waitingSignal = readSseUntil(roomId, ali.token, 'event: signal')
await new Promise((resolve) => setTimeout(resolve, 300))
await call(`/api/rooms/${roomId}/signal`, {
  method: 'POST',
  token: ayse.token,
  body: { type: 'countdown', data: { seconds: 3 } },
})
const signalStream = await waitingSignal
assert(signalStream.includes('"type":"countdown"'), 'sinyal odaya iletilmeli')
assert(signalStream.includes(ayse.user.uid), 'sinyalde gönderen bilgisi olmalı')
step('Sinyal kanalı', 'countdown iletildi')

console.log('\n✅ Duman testi geçti\n')
for (const entry of steps) {
  console.log(`   • ${entry.name}${entry.detail ? `: ${entry.detail}` : ''}`)
}
console.log('')
