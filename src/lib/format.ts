const clockFormatter = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
})

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
})

/** 75 → "1:15", 3671 → "1:01:11" */
export function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00'
  const seconds = Math.floor(totalSeconds)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remaining = seconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
  }
  return `${minutes}:${String(remaining).padStart(2, '0')}`
}

export function formatDurationLong(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '—'
  const seconds = Math.floor(totalSeconds)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours} sa ${minutes} dk`
  if (minutes > 0) return `${minutes} dk`
  return `${seconds} sn`
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Sohbet balonlarında kullanılan akıllı saat biçimi. */
export function formatMessageTime(timestamp: number | null): string {
  if (!timestamp) return 'şimdi'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'şimdi'

  const today = startOfDay(new Date())
  const messageDay = startOfDay(date)
  const dayDifference = Math.round((today - messageDay) / 86_400_000)

  if (dayDifference === 0) return clockFormatter.format(date)
  if (dayDifference === 1) return `Dün ${clockFormatter.format(date)}`
  if (date.getFullYear() === new Date().getFullYear()) {
    return `${dateFormatter.format(date)} ${clockFormatter.format(date)}`
  }
  return `${date.toLocaleDateString('tr-TR')} ${clockFormatter.format(date)}`
}

export function formatRelative(timestamp: number | null): string {
  if (!timestamp) return 'bilinmiyor'
  const diff = Date.now() - timestamp
  if (diff < 45_000) return 'az önce'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes} dk önce`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} sa önce`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} gün önce`
  return dateFormatter.format(new Date(timestamp))
}

export function formatRoomDate(timestamp: number | null): string {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
