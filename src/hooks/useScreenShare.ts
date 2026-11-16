import { isP2P } from '@/lib/mode'
import { useScreenShareServer } from '@/hooks/server/useScreenShareServer'
import { useScreenShareP2P } from '@/hooks/p2p/useScreenShareP2P'

export type { ScreenShareResult, ScreenShareRole } from '@/hooks/screenShareTypes'

export const useScreenShare = isP2P ? useScreenShareP2P : useScreenShareServer