import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function parseEnvFile(file) {
  if (!existsSync(file)) return {}

  const values = {}
  const content = readFileSync(file, 'utf8')

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separator = line.indexOf('=')
    if (separator === -1) continue

    const key = line.slice(0, separator).trim()
    if (!key) continue

    let value = line.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }

  return values
}

function positiveNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function loadConfig() {
  // .env dosyaları yalnızca eksik anahtarları tamamlar; gerçek ortam değişkenleri
  // her zaman önceliklidir.
  const fileEnv = {
    ...parseEnvFile(join(ROOT, '.env')),
    ...parseEnvFile(join(ROOT, '.env.local')),
  }
  const env = { ...fileEnv, ...process.env }

  return {
    root: ROOT,
    port: Math.round(positiveNumber(env.NOTIFY_PORT || env.PORT, 8787)),
    host: env.NOTIFY_HOST?.trim() || '0.0.0.0',
    publicDir: join(ROOT, 'dist'),
    dataFile: join(ROOT, '.data', 'state.json'),
    maxRoomAgeDays: positiveNumber(env.ROOM_TTL_DAYS, 30),
  }
}
