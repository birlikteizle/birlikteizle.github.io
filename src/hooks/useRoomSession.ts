import { isP2P } from '@/lib/mode'
import { useRoomSessionServer } from '@/hooks/server/useRoomSessionServer'
import { useRoomSessionP2P } from '@/hooks/p2p/useRoomSessionP2P'

export type { RoomSessionResult, RoomSessionStatus } from '@/hooks/roomSessionTypes'

export const useRoomSession = isP2P ? useRoomSessionP2P : useRoomSessionServer