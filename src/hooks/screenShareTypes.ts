export type ScreenShareRole = 'idle' | 'sharing' | 'watching'

export interface ScreenShareResult {
  role: ScreenShareRole
  error: string | null
  sharerName: string | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  startSharing: () => Promise<void>
  stopSharing: () => void
  isSharing: boolean
  isWatching: boolean
}