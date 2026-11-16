import type { RoomInfo, RoomMembers, RoomPresenceMap } from '@/types'

export type RoomSessionStatus = 'validating' | 'ready' | 'not-found' | 'full' | 'closed' | 'error'

export interface RoomSessionResult {
  status: RoomSessionStatus
  error: string | null
  info: RoomInfo | null
  members: RoomMembers
  presence: RoomPresenceMap
  /** Bu oturumdaki kullanıcı oynatmayı yönetebilir mi? (Odayı kuran kişi.) */
  canManage: boolean
}