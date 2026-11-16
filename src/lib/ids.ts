const ROOM_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** 22 rastgele bayt → 22 karakterlik, tahmin edilmesi pratik olarak imkânsız kimlik. */
export function generateRoomId(length = 22): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let id = ''
  for (const byte of bytes) {
    id += ROOM_ID_ALPHABET[byte % ROOM_ID_ALPHABET.length]
  }
  return id
}

export function createCommandId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{16,32}$/

export function isValidRoomId(value: string): boolean {
  return ROOM_ID_PATTERN.test(value)
}
