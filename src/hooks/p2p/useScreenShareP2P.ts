import { useCallback, useEffect, useRef, useState } from 'react'
import { retainP2PRoom } from '@/lib/p2p/room'
import type { BroadcastKind, ScreenShareResult, ScreenShareRole } from '@/hooks/screenShareTypes'
import { captureBroadcast, captureCamera, broadcastErrorMessage, supportsCamera, supportsScreen } from '@/lib/mediaCapture'

/**
 * Sunucusuz (P2P) yayın. Trystero medya akışını doğrudan eşler arasında kurar.
 *
 * Masaüstünde ekran/sekme, telefonda kamera yayını kullanılır; ikisi de aynı
 * kanaldan gider.
 */
export function useScreenShareP2P(
  roomId: string,
  _uid: string,
  displayName: string,
): ScreenShareResult {
  const [role, setRole] = useState<ScreenShareRole>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sharerName, setSharerName] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [kind, setKind] = useState<BroadcastKind | null>(null)
  const [micEnabled, setMicEnabled] = useState(true)

  const roleRef = useRef<ScreenShareRole>('idle')
  roleRef.current = role
  const localStreamRef = useRef<MediaStream | null>(null)
  const roomRef = useRef<ReturnType<typeof retainP2PRoom>['room'] | null>(null)

  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment')

  useEffect(() => {
    const { room, release } = retainP2PRoom(roomId)
    roomRef.current = room

    const unsubscribe = room.subscribe((event) => {
      if (event.type === 'stream') {
        if (roleRef.current === 'sharing') return
        setRemoteStream(event.stream)
        setRole('watching')
        setError(null)
      } else if (event.type === 'peers' && event.peerIds.length === 0) {
        if (roleRef.current === 'watching') {
          setRemoteStream(null)
          setRole('idle')
          setSharerName(null)
        }
      }
    })

    return () => {
      unsubscribe()
      const stream = localStreamRef.current
      for (const track of stream?.getTracks() ?? []) track.stop()
      localStreamRef.current = null
      room.removeStream()
      release()
      roomRef.current = null
    }
  }, [roomId])

  const stopSharing = useCallback(() => {
    const stream = localStreamRef.current
    localStreamRef.current = null
    for (const track of stream?.getTracks() ?? []) {
      track.onended = null
      track.stop()
    }
    setLocalStream(null)
    roomRef.current?.removeStream()
    setRole('idle')
    setSharerName(null)
    setKind(null)
  }, [])

  const startSharing = useCallback(
    async (requested: BroadcastKind = 'screen') => {
      if (roleRef.current !== 'idle') return
      setError(null)

      const mode: BroadcastKind = requested === 'screen' && supportsScreen() ? 'screen' : 'camera'

      try {
        const { stream, kind: actualKind } = await captureBroadcast(mode, {
          facingMode: cameraFacing,
          withAudio: true,
        })

        localStreamRef.current = stream
        setLocalStream(stream)
        setRole('sharing')
        setSharerName(displayName)
        setKind(actualKind)
        setMicEnabled(stream.getAudioTracks().length > 0)

        for (const track of stream.getTracks()) {
          if (track.kind === 'video' && actualKind === 'screen') {
            track.onended = () => stopSharing()
          }
        }

        const room = roomRef.current
        if (!room) {
          setError('Oda bağlantısı hazır değil. Sayfayı yenileyip tekrar dene.')
          stopSharing()
          return
        }
        await room.addStream(stream)
      } catch (caught) {
        setError(broadcastErrorMessage(caught, mode))
        localStreamRef.current = null
        setLocalStream(null)
        setRole('idle')
        setSharerName(null)
        setKind(null)
      }
    },
    [cameraFacing, displayName, stopSharing],
  )

  const switchCamera = useCallback(async () => {
    const stream = localStreamRef.current
    const room = roomRef.current
    if (!stream || !room || roleRef.current !== 'sharing') return

    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment'
    try {
      const fresh = await captureCamera({ facingMode: nextFacing, withAudio: false })
      const newTrack = fresh.getVideoTracks()[0]
      const oldTrack = stream.getVideoTracks()[0]
      if (!newTrack || !oldTrack) return

      const audioTracks = stream.getAudioTracks()
      const combined = new MediaStream([newTrack, ...audioTracks])

      await room.replaceVideoTrack(oldTrack, newTrack)
      oldTrack.stop()
      localStreamRef.current = combined
      setLocalStream(combined)
      setCameraFacing(nextFacing)
      setMicEnabled(combined.getAudioTracks().some((track) => track.enabled))
    } catch (caught) {
      setError(broadcastErrorMessage(caught, 'camera'))
    }
  }, [cameraFacing])

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const tracks = stream.getAudioTracks()
    if (tracks.length === 0) return
    const next = !tracks.some((track) => track.enabled)
    for (const track of tracks) track.enabled = next
    setMicEnabled(next)
  }, [])

  return {
    role,
    error,
    sharerName,
    localStream,
    remoteStream,
    startSharing,
    stopSharing,
    isSharing: role === 'sharing',
    isWatching: role === 'watching',
    kind,
    canShareScreen: supportsScreen(),
    canShareCamera: supportsCamera(),
    switchCamera,
    micEnabled,
    toggleMic,
  }
}
