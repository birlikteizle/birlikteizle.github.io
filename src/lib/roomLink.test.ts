import { describe, expect, it } from 'vitest'
import { parseRoomReference, shortRoomCode } from '@/lib/roomLink'
import { generateRoomId, isValidRoomId } from '@/lib/ids'

const ROOM_ID = 'AbCdEfGhIjKlMnOpQrStUv'

describe('isValidRoomId', () => {
  it('16-32 karakterlik güvenli kimlikleri kabul eder', () => {
    expect(isValidRoomId(ROOM_ID)).toBe(true)
    expect(isValidRoomId('abc_DEF-1234567890')).toBe(true)
  })

  it('kısa, uzun ve özel karakterli kimlikleri reddeder', () => {
    expect(isValidRoomId('short')).toBe(false)
    expect(isValidRoomId('a'.repeat(33))).toBe(false)
    expect(isValidRoomId('gecersiz kimlik 123')).toBe(false)
    expect(isValidRoomId('abc/def')).toBe(false)
  })
})

describe('generateRoomId', () => {
  it('22 karakterlik alfanümerik kimlik üretir', () => {
    const id = generateRoomId()
    expect(id).toHaveLength(22)
    expect(isValidRoomId(id)).toBe(true)
    expect(/^[A-Za-z0-9]+$/.test(id)).toBe(true)
  })

  it('ardışık çağrılarda farklı kimlikler üretir', () => {
    const ids = new Set(Array.from({ length: 40 }, () => generateRoomId()))
    expect(ids.size).toBe(40)
  })
})

describe('parseRoomReference', () => {
  it('çıplak oda kimliğini olduğu gibi döndürür', () => {
    expect(parseRoomReference(`  ${ROOM_ID}  `)).toBe(ROOM_ID)
  })

  it('tam davet bağlantısını ve /join yolunu okur', () => {
    expect(parseRoomReference(`https://birlikte.example/room/${ROOM_ID}`)).toBe(ROOM_ID)
    expect(parseRoomReference(`https://birlikte.example/join/${ROOM_ID}?x=1`)).toBe(ROOM_ID)
  })

  it('şema içermeyen bağlantıyı tamamlar', () => {
    expect(parseRoomReference(`birlikte.example/room/${ROOM_ID}`)).toBe(ROOM_ID)
    expect(parseRoomReference(`example.com/oda/${ROOM_ID}`)).toBe(ROOM_ID)
  })

  it('geçersiz veya rastgele girdilerde null döndürür', () => {
    expect(parseRoomReference('')).toBeNull()
    expect(parseRoomReference('https://example.com/')).toBeNull()
    expect(parseRoomReference('https://example.com/room/kisa')).toBeNull()
    expect(parseRoomReference('merhaba dünya')).toBeNull()
  })
})

describe('shortRoomCode', () => {
  it('ilk 8 karakteri büyük harfe çevirir', () => {
    expect(shortRoomCode(ROOM_ID)).toBe('ABCDEFGH')
  })
})
