import type {
  ChatMessage,
  PlaybackStatus,
  RoomSnapshot,
  VideoProvider,
  VideoSource,
} from '@/types'
import type { AppUser } from '@/types'
import { currentToken, readSession } from '@/lib/session'

const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '')

export function apiBaseUrl(): string {
  return BASE
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status = 0, code = 'NETWORK') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  token?: string
  signal?: AbortSignal
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options
  const token = options.token ?? currentToken()
  const headers: Record<string, string> = { accept: 'application/json' }
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if ((error as { name?: string }).name === 'AbortError') throw error
    throw new ApiError(
      'Sunucuya ulaşılamadı. Bildirim sunucusunun çalıştığından emin ol.',
      0,
      'NETWORK',
    )
  }

  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const payload = (data ?? {}) as { error?: unknown; code?: unknown }
    throw new ApiError(
      typeof payload.error === 'string' && payload.error
        ? payload.error
        : `İstek başarısız oldu (HTTP ${response.status}).`,
      response.status,
      typeof payload.code === 'string' ? payload.code : 'HTTP_ERROR',
    )
  }

  return data as T
}

export interface RegisterResult {
  user: AppUser
  token: string
}

export interface PlaybackCommandPayload {
  status: PlaybackStatus
  currentTime: number
  playbackRate: number
  sourceUrl?: string
  provider?: VideoProvider
  videoId?: string
  commandId: string
}

export interface HealthResult {
  ok: boolean
  serverTime: number
  version: string
  rooms: { total: number; active: number }
}

export const api = {
  time: (signal?: AbortSignal) => request<{ now: number }>('/api/time', { signal }),

  health: (signal?: AbortSignal) => request<HealthResult>('/api/health', { signal }),

  register: (displayName: string) =>
    request<RegisterResult>('/api/auth/register', {
      method: 'POST',
      body: { displayName },
      token: '',
    }),

  me: (token: string, signal?: AbortSignal) =>
    request<{ user: AppUser }>('/api/auth/me', { token, signal }),

  createRoom: (source: VideoSource | null, capacity?: number) =>
    request<{ roomId: string }>('/api/rooms', {
      method: 'POST',
      body: { source, capacity },
    }),

  joinRoom: (roomId: string) =>
    request<{ status: string }>(`/api/rooms/${roomId}/join`, { method: 'POST', body: {} }),

  getRoom: (roomId: string, signal?: AbortSignal) =>
    request<RoomSnapshot>(`/api/rooms/${roomId}`, { signal }),

  playback: (roomId: string, command: PlaybackCommandPayload) =>
    request<{ playback: RoomSnapshot['playback'] }>(`/api/rooms/${roomId}/playback`, {
      method: 'POST',
      body: command,
    }),

  sendMessage: (roomId: string, text: string) =>
    request<{ message: ChatMessage }>(`/api/rooms/${roomId}/messages`, {
      method: 'POST',
      body: { text },
    }),

  ping: (roomId: string) =>
    request<{ ok: boolean; now: number }>(`/api/rooms/${roomId}/ping`, {
      method: 'POST',
      body: {},
    }),

  leave: (roomId: string) =>
    request<{ ok: boolean }>(`/api/rooms/${roomId}/leave`, { method: 'POST', body: {} }),

  signal: (roomId: string, type: string, data?: unknown) =>
    request<{ ok: boolean; at: number }>(`/api/rooms/${roomId}/signal`, {
      method: 'POST',
      body: { type, data: data ?? null },
    }),
}

export function hasSession(): boolean {
  return Boolean(readSession()?.token)
}
