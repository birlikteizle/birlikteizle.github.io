import { useEffect, useState } from 'react'
import type { AppUser, RoomInfo, RoomMembers, RoomPresenceMap } from '@/types'
import { api, ApiError } from '@/lib/api'
import { mapApiError } from '@/lib/errors'
import { isValidRoomId } from '@/lib/ids'
import { getRoomChannel } from '@/lib/roomChannel'
import type { RoomSessionResult, RoomSessionStatus } from '@/hooks/roomSessionTypes'

const PING_INTERVAL_MS = 25_000

/**
 * Sunucu modu: odaya katılır, üyelik/presence verisini SSE kanalından dinler ve
 * çevrimiçi kalma sinyali gönderir. Kanallar unmount'ta paylaşımlı havuzdan düşer.
 */
export function useRoomSessionServer(
  roomId: string | undefined,
  user: AppUser,
): RoomSessionResult {
  const [status, setStatus] = useState<RoomSessionStatus>('validating')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<RoomInfo | null>(null)
  const [members, setMembers] = useState<RoomMembers>({})
  const [presence, setPresence] = useState<RoomPresenceMap>({})

  const { uid, displayName } = user

  useEffect(() => {
    if (!roomId || !isValidRoomId(roomId)) {
      setStatus('not-found')
      return
    }

    let cancelled = false
    setStatus('validating')
    setError(null)

    const run = async () => {
      try {
        await api.joinRoom(roomId)
        if (cancelled) return

        setStatus('ready')
        const snapshot = await api.getRoom(roomId)
        if (cancelled) return

        setInfo(snapshot.info)
        setMembers(snapshot.members)
        setPresence(snapshot.presence)
      } catch (joinError) {
        if (cancelled) return

        const code = joinError instanceof ApiError ? joinError.code : ''
        if (code === 'ROOM_FULL') {
          setStatus('full')
          return
        }
        if (code === 'ROOM_NOT_FOUND') {
          setStatus('not-found')
          return
        }
        if (code === 'ROOM_CLOSED') {
          setStatus('closed')
          return
        }

        setError(mapApiError(joinError))
        setStatus('error')
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [roomId, uid, displayName])

  useEffect(() => {
    if (status !== 'ready' || !roomId) return

    const channel = getRoomChannel(roomId)
    return channel.subscribe((event) => {
      if (event.type === 'snapshot') {
        setInfo(event.snapshot.info)
        setMembers(event.snapshot.members)
        setPresence(event.snapshot.presence)
        if (event.snapshot.info?.status && event.snapshot.info.status !== 'active') {
          setStatus('closed')
        }
      } else if (event.type === 'members') {
        setMembers(event.members)
      } else if (event.type === 'presence') {
        setPresence(event.presence)
      } else if (event.type === 'info') {
        setInfo(event.info)
        if (event.info.status !== 'active') setStatus('closed')
      }
    })
  }, [status, roomId])

  useEffect(() => {
    if (status !== 'ready' || !roomId) return

    const ping = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      void api.ping(roomId).catch(() => undefined)
    }

    ping()
    const interval = window.setInterval(ping, PING_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [status, roomId])

  useEffect(() => {
    if (status !== 'ready' || !roomId) return

    const checkRoom = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      try {
        const snapshot = await api.getRoom(roomId)
        if (snapshot.info?.status !== 'active') setStatus('closed')
      } catch (checkError) {
        if (checkError instanceof ApiError && checkError.code === 'ROOM_NOT_FOUND') {
          setStatus('not-found')
        }
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkRoom()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [status, roomId])

  return { status, error, info, members, presence }
}