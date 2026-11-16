import { afterEach, describe, expect, it } from 'vitest'
import {
  broadcastErrorMessage,
  captureBroadcast,
  isUnsupportedMediaError,
  preferredBroadcastKind,
  supportsCamera,
  supportsScreen,
} from '@/lib/mediaCapture'

interface FakeGlobals {
  navigator?: unknown
  window?: unknown
}

const originalNavigator = (globalThis as FakeGlobals).navigator
const originalWindow = (globalThis as FakeGlobals).window

function setGlobals({ navigator, window }: FakeGlobals) {
  // Node 22+ ortamında `navigator` salt-okunur bir tanımlayıcıdır; bu yüzden
  // doğrudan atama yerine tanımlama kullanılır.
  Object.defineProperty(globalThis, 'navigator', {
    value: navigator,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, 'window', {
    value: window,
    configurable: true,
    writable: true,
  })
}

afterEach(() => {
  setGlobals({ navigator: originalNavigator, window: originalWindow })
})

/** Masaüstü Chrome benzeri ortam: hem ekran hem kamera var. */
function desktopEnvironment() {
  setGlobals({
    navigator: {
      mediaDevices: {
        getDisplayMedia: async () => null,
        getUserMedia: async () => null,
      },
    },
    window: { isSecureContext: true, matchMedia: () => ({ matches: false }) },
  })
}

/** Telefon benzeri ortam: ekran yakalama yok, kamera var. */
function mobileEnvironment() {
  setGlobals({
    navigator: {
      mediaDevices: {
        getUserMedia: async () => null,
      },
    },
    window: { isSecureContext: true, matchMedia: () => ({ matches: true }) },
  })
}

describe('yayın yetenekleri', () => {
  it('masaüstünde ekran ve kamera desteklenir', () => {
    desktopEnvironment()
    expect(supportsScreen()).toBe(true)
    expect(supportsCamera()).toBe(true)
    expect(preferredBroadcastKind()).toBe('screen')
  })

  it('telefonda ekran desteklenmez ama kamera desteklenir', () => {
    mobileEnvironment()
    expect(supportsScreen()).toBe(false)
    expect(supportsCamera()).toBe(true)
    // Telefonda varsayılan yayın türü kamera olmalı.
    expect(preferredBroadcastKind()).toBe('camera')
  })

  it('medya API yoksa ikisi de desteklenmez', () => {
    setGlobals({ navigator: {}, window: { isSecureContext: true } })
    expect(supportsScreen()).toBe(false)
    expect(supportsCamera()).toBe(false)
  })
})

describe('broadcastErrorMessage', () => {
  it('izin reddini açıklar', () => {
    const error = { name: 'NotAllowedError' }
    expect(broadcastErrorMessage(error, 'screen')).toContain('izin')
    expect(broadcastErrorMessage(error, 'camera')).toContain('izin')
  })

  it('desteklenmeyen cihazda kamera önerir', () => {
    const message = broadcastErrorMessage({ name: 'NotSupportedError' }, 'screen')
    expect(message).toContain('kamera')
  })

  it('bilinmeyen hatada genel mesaj döner', () => {
    expect(broadcastErrorMessage(new Error('beklenmeyen'), 'camera')).toContain('Yayın başlatılamadı')
  })
})

function fakeStream(kind: 'screen' | 'camera'): MediaStream {
  return {
    id: kind,
    getTracks: () => [],
    getAudioTracks: () => [],
    getVideoTracks: () => [],
  } as unknown as MediaStream
}

describe('isUnsupportedMediaError', () => {
  it('desteklenmeyen hataları tanır', () => {
    expect(isUnsupportedMediaError({ name: 'NotSupportedError' })).toBe(true)
    expect(isUnsupportedMediaError({ name: 'TypeError' })).toBe(true)
  })

  it('izin hatalarını desteklenmeyen saymaz', () => {
    expect(isUnsupportedMediaError({ name: 'NotAllowedError' })).toBe(false)
  })
})

describe('captureBroadcast', () => {
  it('ekran destekleniyorsa ekranı kullanır', async () => {
    setGlobals({
      navigator: {
        mediaDevices: {
          getDisplayMedia: async () => fakeStream('screen'),
          getUserMedia: async () => fakeStream('camera'),
        },
      },
      window: { isSecureContext: true },
    })

    const result = await captureBroadcast('screen')
    expect(result.kind).toBe('screen')
  })

  it('ekran çağrısı desteklenmiyor hatası verirse kameraya düşer', async () => {
    setGlobals({
      navigator: {
        mediaDevices: {
          getDisplayMedia: async () => {
            // Bazı mobil sürümler yöntemi tanımlar ama her çağrıda hata verir.
            throw Object.assign(new Error('nope'), { name: 'NotSupportedError' })
          },
          getUserMedia: async () => fakeStream('camera'),
        },
      },
      window: { isSecureContext: true },
    })

    const result = await captureBroadcast('screen')
    expect(result.kind).toBe('camera')
  })

  it('kullanıcı ekran paylaşımını iptal ederse kameraya düşmez', async () => {
    setGlobals({
      navigator: {
        mediaDevices: {
          getDisplayMedia: async () => {
            throw Object.assign(new Error('iptal'), { name: 'NotAllowedError' })
          },
          getUserMedia: async () => fakeStream('camera'),
        },
      },
      window: { isSecureContext: true },
    })

    await expect(captureBroadcast('screen')).rejects.toThrow('iptal')
  })

  it('kamera istendiğinde doğrudan kamerayı açar', async () => {
    mobileEnvironment()
    const result = await captureBroadcast('camera')
    expect(result.kind).toBe('camera')
  })
})
