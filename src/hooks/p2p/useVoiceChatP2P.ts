import { useCallback, useEffect, useRef, useState } from 'react'
import { retainP2PRoom } from '@/lib/p2p/room'
import { voiceErrorMessage, type VoiceChatResult, type VoicePeer } from '@/hooks/voiceChatTypes'

/**
 * Sunucusuz (P2P) sesli sohbet.
 *
 * Mikrofon ve kamera **kapalı** başlar; "Sese katıl" ile mikrofon izni istenir.
 * Akış Trystero üzerinden tüm eşlere doğrudan gönderilir (mesh).
 */
export function useVoiceChatP2P(
  roomId: string,
  uid: string,
  displayName: string,
): VoiceChatResult {
  const [inVoice, setInVoice] = useState(false)
  const [micEnabled, setMicEnabled] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<VoicePeer[]>([])
  const [error, setError] = useState<string | null>(null)

  const localStreamRef = useRef<MediaStream | null>(null)
  const inVoiceRef = useRef(false)
  inVoiceRef.current = inVoice
  const roomRef = useRef<ReturnType<typeof retainP2PRoom>['room'] | null>(null)
  const peersRef = useRef(new Map<string, VoicePeer>())

  const publishPeers = useCallback(() => {
    setPeers([...peersRef.current.values()])
  }, [])

  const announce = useCallback(
    (mic: boolean, cam: boolean) => {
      roomRef.current?.sendVoiceState(uid, displayName, mic, cam)
    },
    [displayName, uid],
  )

  useEffect(() => {
    const { room, release } = retainP2PRoom(roomId)
    roomRef.current = room

    const unsubscribe = room.subscribe((event) => {
      if (event.type === 'voice-stream') {
        const existing = peersRef.current.get(event.peerId)
        peersRef.current.set(event.peerId, {
          id: event.peerId,
          uid: existing?.uid ?? '',
          name: existing?.name ?? 'Katılımcı',
          stream: event.stream,
          micOn: existing?.micOn ?? true,
          camOn: existing?.camOn ?? event.stream.getVideoTracks().length > 0,
        })
        publishPeers()
      } else if (event.type === 'voice-state') {
        if (event.uid === uid) return
        const existing = [...peersRef.current.entries()].find(([, peer]) => peer.uid === event.uid)
        if (event.name) {
          const id = existing?.[0] ?? event.uid
          peersRef.current.set(id, {
            id,
            uid: event.uid,
            name: event.name,
            stream: existing?.[1].stream ?? null,
            micOn: event.mic,
            camOn: event.cam,
          })
          publishPeers()
        } else if (existing) {
          peersRef.current.delete(existing[0])
          publishPeers()
        }
      } else if (event.type === 'voice-gone') {
        // Eş ayrıldı: kaydı ve akışını düşür.
        const existing = peersRef.current.get(event.peerId)
        if (existing) {
          peersRef.current.delete(event.peerId)
          publishPeers()
        }
      }
    })

    return () => {
      unsubscribe()
      const stream = localStreamRef.current
      for (const track of stream?.getTracks() ?? []) track.stop()
      localStreamRef.current = null
      room.removeVoiceStream()
      peersRef.current.clear()
      release()
      roomRef.current = null
    }
  }, [publishPeers, roomId, uid])

  const join = useCallback(async () => {
    if (inVoiceRef.current) return
    setError(null)

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Bu tarayıcı sesli sohbeti desteklemiyor.')
      return
    }

    try {
      // Mikrofon açık, kamera kapalı başlar.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream
      setLocalStream(stream)
      setInVoice(true)
      setMicEnabled(true)
      setCameraEnabled(false)

      await roomRef.current?.addVoiceStream(stream)
      announce(true, false)
    } catch (caught) {
      setError(voiceErrorMessage(caught))
    }
  }, [announce])

  const leave = useCallback(() => {
    const stream = localStreamRef.current
    for (const track of stream?.getTracks() ?? []) track.stop()
    localStreamRef.current = null
    setLocalStream(null)
    setInVoice(false)
    setMicEnabled(false)
    setCameraEnabled(false)
    roomRef.current?.removeVoiceStream()
    roomRef.current?.sendVoiceLeave(uid)
  }, [uid])

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const tracks = stream.getAudioTracks()
    if (tracks.length === 0) return
    const next = !tracks.some((track) => track.enabled)
    for (const track of tracks) track.enabled = next
    setMicEnabled(next)
    announce(next, cameraEnabled)
  }, [announce, cameraEnabled])

  const toggleCamera = useCallback(async () => {
    const stream = localStreamRef.current
    const room = roomRef.current
    if (!stream || !room) return
    setError(null)

    try {
      if (cameraEnabled) {
        // Kamerayı kapat: video kanalını durdur ve akışı yeniden yayınla.
        for (const track of stream.getVideoTracks()) track.stop()
        const audioOnly = new MediaStream(stream.getAudioTracks())
        room.removeVoiceStream()
        localStreamRef.current = audioOnly
        setLocalStream(audioOnly)
        setCameraEnabled(false)
        await room.addVoiceStream(audioOnly)
        announce(micEnabled, false)
        return
      }

      const camera = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } },
      })
      const videoTrack = camera.getVideoTracks()[0]
      if (!videoTrack) return

      const combined = new MediaStream([...stream.getAudioTracks(), videoTrack])
      room.removeVoiceStream()
      localStreamRef.current = combined
      setLocalStream(combined)
      setCameraEnabled(true)
      await room.addVoiceStream(combined)
      announce(micEnabled, true)
    } catch (caught) {
      setError(voiceErrorMessage(caught))
    }
  }, [announce, cameraEnabled, micEnabled])

  return {
    inVoice,
    micEnabled,
    cameraEnabled,
    localStream,
    peers,
    error,
    join,
    leave,
    toggleMic,
    toggleCamera,
  }
}