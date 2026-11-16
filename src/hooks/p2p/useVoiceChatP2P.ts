import { useCallback, useEffect, useRef, useState } from 'react'
import { retainP2PRoom } from '@/lib/p2p/room'
import { voiceErrorMessage, type VoiceChatResult, type VoicePeer } from '@/hooks/voiceChatTypes'

interface PeerMedia {
  uid: string
  name: string
  mic: boolean
  cam: boolean
  audio: MediaStream | null
  video: MediaStream | null
}

function mergeStreams(entry: PeerMedia): MediaStream | null {
  const tracks = [...(entry.audio?.getTracks() ?? []), ...(entry.video?.getTracks() ?? [])]
  if (tracks.length === 0) return null
  return new MediaStream(tracks)
}

/**
 * Sunucusuz (P2P) sesli sohbet.
 *
 * Mikrofon ve kamera **kapalı** başlar. Ses ve görüntü ayrı akışlar olarak
 * yayınlanır ve alıcı tarafta tek akışta birleştirilir; böylece kamera sonradan
 * açıldığında ses bağlantısı kopmadan görüntü eklenir.
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

  const audioStreamRef = useRef<MediaStream | null>(null)
  const videoStreamRef = useRef<MediaStream | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const inVoiceRef = useRef(false)
  inVoiceRef.current = inVoice
  const roomRef = useRef<ReturnType<typeof retainP2PRoom>['room'] | null>(null)
  const peersRef = useRef(new Map<string, PeerMedia>())

  const publishPeers = useCallback(() => {
    setPeers(
      [...peersRef.current.entries()].map(([id, entry]) => ({
        id,
        uid: entry.uid,
        name: entry.name,
        stream: mergeStreams(entry),
        micOn: entry.mic,
        camOn: entry.cam,
      })),
    )
  }, [])

  const announce = useCallback(
    (mic: boolean, cam: boolean) => {
      roomRef.current?.sendVoiceState(uid, displayName, mic, cam)
    },
    [displayName, uid],
  )

  const rebuildLocalStream = useCallback(() => {
    const tracks = [
      ...(audioStreamRef.current?.getTracks() ?? []),
      ...(videoStreamRef.current?.getTracks() ?? []),
    ]
    const stream = tracks.length > 0 ? new MediaStream(tracks) : null
    localStreamRef.current = stream
    setLocalStream(stream)
  }, [])

  useEffect(() => {
    const { room, release } = retainP2PRoom(roomId)
    roomRef.current = room

    const unsubscribe = room.subscribe((event) => {
      if (event.type === 'voice-stream') {
        const existing = peersRef.current.get(event.peerId) ?? {
          uid: '',
          name: 'Katılımcı',
          mic: true,
          cam: false,
          audio: null,
          video: null,
        }
        if (event.video) existing.video = event.stream
        else existing.audio = event.stream
        existing.cam = Boolean(existing.video)
        peersRef.current.set(event.peerId, existing)
        publishPeers()
      } else if (event.type === 'voice-state') {
        if (event.uid === uid) return
        const entry = [...peersRef.current.entries()].find(([, peer]) => peer.uid === event.uid)
        if (!event.name) {
          if (entry) {
            peersRef.current.delete(entry[0])
            publishPeers()
          }
          return
        }
        const id = entry?.[0] ?? event.uid
        const peer = entry?.[1] ?? {
          uid: event.uid,
          name: event.name,
          mic: event.mic,
          cam: event.cam,
          audio: null,
          video: null,
        }
        peer.uid = event.uid
        peer.name = event.name
        peer.mic = event.mic
        peer.cam = event.cam
        peersRef.current.set(id, peer)
        publishPeers()
      } else if (event.type === 'voice-gone') {
        if (peersRef.current.delete(event.peerId)) publishPeers()
      }
    })

    return () => {
      unsubscribe()
      for (const stream of [audioStreamRef.current, videoStreamRef.current]) {
        for (const track of stream?.getTracks() ?? []) track.stop()
      }
      audioStreamRef.current = null
      videoStreamRef.current = null
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
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      audioStreamRef.current = audio
      videoStreamRef.current = null
      rebuildLocalStream()
      setInVoice(true)
      setMicEnabled(true)
      setCameraEnabled(false)

      await roomRef.current?.addVoiceStream(audio, false)
      announce(true, false)
    } catch (caught) {
      setError(voiceErrorMessage(caught))
    }
  }, [announce, rebuildLocalStream])

  const leave = useCallback(() => {
    for (const stream of [audioStreamRef.current, videoStreamRef.current]) {
      for (const track of stream?.getTracks() ?? []) track.stop()
    }
    audioStreamRef.current = null
    videoStreamRef.current = null
    localStreamRef.current = null
    setLocalStream(null)
    setInVoice(false)
    setMicEnabled(false)
    setCameraEnabled(false)
    roomRef.current?.removeVoiceStream()
    roomRef.current?.sendVoiceLeave(uid)
  }, [uid])

  const toggleMic = useCallback(() => {
    const stream = audioStreamRef.current
    if (!stream) return
    const tracks = stream.getAudioTracks()
    if (tracks.length === 0) return
    const next = !tracks.some((track) => track.enabled)
    for (const track of tracks) track.enabled = next
    setMicEnabled(next)
    announce(next, cameraEnabled)
  }, [announce, cameraEnabled])

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current
    if (!room || !inVoiceRef.current) return
    setError(null)

    try {
      if (cameraEnabled) {
        const stream = videoStreamRef.current
        videoStreamRef.current = null
        if (stream) room.removeVoiceStream(stream)
        for (const track of stream?.getTracks() ?? []) track.stop()
        rebuildLocalStream()
        setCameraEnabled(false)
        announce(micEnabled, false)
        return
      }

      const camera = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      if (camera.getVideoTracks().length === 0) return

      videoStreamRef.current = camera
      rebuildLocalStream()
      setCameraEnabled(true)
      await room.addVoiceStream(camera, true)
      announce(micEnabled, true)
    } catch (caught) {
      setError(voiceErrorMessage(caught))
    }
  }, [announce, cameraEnabled, micEnabled, rebuildLocalStream])

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