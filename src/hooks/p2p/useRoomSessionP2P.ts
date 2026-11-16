import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppUser, RoomInfo, RoomMembers, RoomPresenceMap } from '@/types'
import { isValidRoomId } from '@/lib/ids'
import { retainP2PRoom, selfMember } from '@/lib/p2p/room'
import { readRoomMetaFromLocation } from '@/lib/roomLink'
import type { RoomSessionResult, RoomSessionStatus } from '@/hooks/roomSessionTypes'

/**
 * Sunucusuz (P2P) oda oturumu.
 *
 * Sunucu olmadığı için "oda" kavramı o anda bağlı olan taraflardan oluşur.
 * Üyelik listesi karşı tarafın tanıtım mesajından (`hello`) öğrenilir; kimse
 * yoksa oda boş görünür ve katılımcı beklenir.
 *
 * Yönetici, davet bağlantısındaki `?a=` değeriyle eşleşen kullanıcıdır; yetki
 * listesini yalnızca o değiştirebilir.
 */
export function useRoomSessionP2P(
  roomId: string | undefined,
  user: AppUser,
): RoomSessionResult {
  const [status, setStatus] = useState<RoomSessionStatus>('validating')
  const [error, setError] = useState<string | null>(null)
  const [members, setMembers] = useState<RoomMembers>({})
  const [presence, setPresence] = useState<RoomPresenceMap>({})
  const [managers, setManagers] = useState<string[]>([])

  const uid = user.uid
  const displayName = user.displayName

  const me = useMemo(() => selfMember(uid, displayName), [uid, displayName])
  const linkMeta = useMemo(() => readRoomMetaFromLocation(), [])
  const capacity = linkMeta.capacity
  const adminUid = linkMeta.adminUid

  /** Yönetici bilinmiyorsa (eski bağlantılar) herkes yönetebilir. */
  const isAdmin = !adminUid || adminUid === uid
  const canManage = isAdmin || managers.includes(uid)

  const info = useMemo<RoomInfo>(
    () => ({
      createdBy: adminUid || uid,
      createdAt: me.joinedAt,
      status: 'active',
      capacity,
      visibility: linkMeta.visibility,
      managers,
    }),
    [adminUid, uid, me.joinedAt, capacity, linkMeta.visibility, managers],
  )

  const membersRef = useRef<RoomMembers>({})
  membersRef.current = members
  const managersRef = useRef<string[]>([])
  managersRef.current = managers

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
          if (event.peerIds.length > 0) {
            // Karşı taraf bağlandı: kimliğimizi (ve yöneticiysek yetki listesini) tanıt.
            const mine: string[] = []
            const payload = {
              member: me,
              managers: managersRef.current.length > 0 || isAdmin ? managersRef.current : mine,
            }
            room.sendHello(payload)
          } else {
            // Bağlı kimse kalmadı: herkesi çevrimdışı işaretle.
            setPresence((previous) => {
              const next: RoomPresenceMap = {}
              for (const [memberUid, value] of Object.entries(previous)) {
                next[memberUid] =
                  memberUid === uid
                    ? { online: true, lastSeen: Date.now() }
                    : { ...value, online: false }
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
          // Yetki listesini yalnızca yöneticinin tanıtımı belirler.
          if (adminUid && partner.uid === adminUid && Array.isArray(event.hello.managers)) {
            setManagers(event.hello.managers)
            room.setManagers(event.hello.managers)
          }
          break
        }
        case 'permissions': {
          if (adminUid && event.from !== adminUid) break
          setManagers(event.managers)
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
  }, [roomId, uid, me, adminUid, isAdmin])

  const setManager = useCallback(
    async (targetUid: string, grant: boolean) => {
      if (!isAdmin) throw new Error('Yetki verme hakkı yalnızca oda yöneticisindedir.')
      if (!targetUid || targetUid === adminUid) return

      const next = grant
        ? Array.from(new Set([...managersRef.current, targetUid]))
        : managersRef.current.filter((value) => value !== targetUid)

      setManagers(next)
      const room = retainP2PRoom(roomId ?? '').room
      room.broadcastManagers(next, uid)
    },
    [adminUid, isAdmin, roomId, uid],
  )

  return { status, error, info, members, presence, canManage, setManager }
}