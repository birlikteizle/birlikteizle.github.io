import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppUser, RoomInfo, RoomMembers, RoomPresenceMap } from '@/types'
import { isValidRoomId } from '@/lib/ids'
import { retainP2PRoom, selfMember } from '@/lib/p2p/room'
import type { RoomSessionResult, RoomSessionStatus } from '@/hooks/roomSessionTypes'

/**
 * Sunucusuz (P2P) oda oturumu.
 *
 * Sunucu olmadığı için "oda" kavramı o anda bağlı olan taraflardan oluşur.
 * Üyelik listesi karşı tarafın tanıtım mesajından (`hello`) öğrenilir; kimse
 * yoksa oda boş görünür ve partner beklenir.
 */
export function useRoomSessionP2P(
  roomId: string | undefined,
  user: AppUser,
): RoomSessionResult {
  const [status, setStatus] = useState<RoomSessionStatus>('validating')
  const [error, setError] = useState<string | null>(null)
  const [members, setMembers] = useState<RoomMembers>({})
  const [presence, setPresence] = useState<RoomPresenceMap>({})

  const uid = user.uid
  const displayName = user.displayName

  const me = useMemo(() => selfMember(uid, displayName), [uid, displayName])
  const info = useMemo<RoomInfo>(
    () => ({ createdBy: uid, createdAt: me.joinedAt, status: 'active' }),
    [uid, me.joinedAt],
  )

  const peersRef = useRef<string[]>([])

  useEffect(() => {
    if (!roomId || !isValidRoomId(roomId)) {
      setStatus('not-found')
      return
    }

    const { room, release } = retainP2PRoom(roomId)

    setStatus('ready')
    setError(null)
    setMembers({ [uid]: me })
    setPresence({ [uid]: { online: true, lastSeen: Date.now() } })

    const unsubscribe = room.subscribe((event) => {
      switch (event.type) {
        case 'peers': {
          peersRef.current = event.peerIds
          if (event.peerIds.length > 0) {
            // Karşı taraf bağlandı: kimliğimizi tanıt.
            room.sendHello({ member: me })
          } else {
            // Bağlı kimse kalmadı: herkesi çevrimdışı işaretle.
            setPresence((previous) => {
              const next: RoomPresenceMap = {}
              for (const [memberUid, value] of Object.entries(previous)) {
                next[memberUid] =
                  memberUid === uid ? { online: true, lastSeen: Date.now() } : { ...value, online: false }
              }
              return next
            })
          }
          break
        }
        case 'hello': {
          const partner = event.hello.member
          if (!partner || partner.uid === uid) break
          setMembers((previous) =>
            previous[partner.uid] ? previous : { ...previous, [partner.uid]: partner },
          )
          setPresence((previous) => ({
            ...previous,
            [partner.uid]: { online: true, lastSeen: Date.now() },
          }))
          break
        }
        case 'bye': {
          setPresence((previous) => {
            const existing = previous[event.uid]
            if (!existing) return previous
            return { ...previous, [event.uid]: { ...existing, online: false } }
          })
          break
        }
        case 'full': {
          setStatus('full')
          break
        }
        case 'error': {
          setError(event.message)
          break
        }
      }
    })

    return () => {
      room.sendBye(uid)
      unsubscribe()
      release()
    }
  }, [roomId, uid, me])

  return { status, error, info, members, presence }
}