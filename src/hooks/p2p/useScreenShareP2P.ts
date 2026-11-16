import { useCallback, useEffect, useRef, useState } from 'react'
import { retainP2PRoom } from '@/lib/p2p/room'
import type { ScreenShareResult, ScreenShareRole } from '@/hooks/screenShareTypes'

/**
 * Sunucusuz (P2P) ekran paylaşımı.
 *
 * Trystero medya akışını doğrudan eşler arasında kurar; ek bir el sıkışma
 * protokolüne gerek yoktur. Paylaşan taraf `addStream`, diğer taraf
 * `onPeerStream` üzerinden akışı alır.
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

  const roleRef = useRef<ScreenShareRole>('idle')
  roleRef.current = role
  const localStreamRef = useRef<MediaStream | null>(null)
  const roomRef = useRef<ReturnType<typeof retainP2PRoom>['room'] | null>(null)
  const releaseRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const { room, release } = retainP2PRoom(roomId)
    roomRef.current = room
    releaseRef.current = release

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
      releaseRef.current = null
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
  }, [])

  const startSharing = useCallback(async () => {
    if (roleRef.current !== 'idle') return
    setError(null)

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      setError('Bu tarayıcı ekran paylaşımını desteklemiyor.')
      return
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError(
        'Ekran paylaşımı için güvenli bağlantı (https) gerekir. GitHub Pages adresi https olduğu ' +
          'için bu sorun yalnızca http üzerinden açtığında görülür.',
      )
      return
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: true,
      })

      localStreamRef.current = stream
      setLocalStream(stream)
      setRole('sharing')
      setSharerName(displayName)

      for (const track of stream.getTracks()) {
        track.onended = () => stopSharing()
      }

      const room = roomRef.current
      if (!room) {
        setError('Oda bağlantısı hazır değil. Sayfayı yenileyip tekrar dene.')
        return
      }
      await room.addStream(stream)
    } catch (caught) {
      const name = (caught as { name?: string }).name
      setError(
        name === 'NotAllowedError'
          ? 'Ekran paylaşımı iptal edildi ya da izin verilmedi.'
          : 'Ekran paylaşımı başlatılamadı. Başka bir uygulama ekranı kullanıyor olabilir.',
      )
      localStreamRef.current = null
      setLocalStream(null)
      setRole('idle')
      setSharerName(null)
    }
  }, [displayName, stopSharing])

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
  }
}