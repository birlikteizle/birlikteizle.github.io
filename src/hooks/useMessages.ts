import { isP2P } from '@/lib/mode'
import { useMessagesServer } from '@/hooks/server/useMessagesServer'
import { useMessagesP2P } from '@/hooks/p2p/useMessagesP2P'

export const useMessages = isP2P ? useMessagesP2P : useMessagesServer