import { isP2P } from '@/lib/mode'
import { useVoiceChatServer } from '@/hooks/server/useVoiceChatServer'
import { useVoiceChatP2P } from '@/hooks/p2p/useVoiceChatP2P'

export type { VoiceChatResult, VoicePeer } from '@/hooks/voiceChatTypes'

/**
 * Sesli sohbet (mikrofon + kamera). İki modda da aynı arayüzü sunar;
 * mikrofon ve kamera kapalı başlar.
 */
export const useVoiceChat = isP2P ? useVoiceChatP2P : useVoiceChatServer