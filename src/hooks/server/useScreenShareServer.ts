import { useCallback, useEffect, useRef, useState } from 'react'
import { useRoomSignals } from '@/hooks/useRoomSignals'
import type { BroadcastKind, ScreenShareResult, ScreenShareRole } from '@/hooks/screenShareTypes'
import {
  broadcastErrorMessage,
  captureCamera,
  captureScreen,
  supportsCamera,
  supportsScreen,
} from '@/lib/mediaCapture'

/**
 * Sunucu modu yayını: el sıkışma sinyalleri SSE kanalından geçer, medya
 * doğrudan iki tarayıcı arasında kurulur (WebRTC).
 *
 * Masaüstünde ekran/sekme, telefonda kamera yayını kullanılır.
 */
export function useScreenShareServer(
  roomId: string,
  uid: string,
  displayName: string,
): ScreenShareResult {
  const { on, send } = useRoomSignals(roomId, uid)

  const [role, setRole] = useState<ScreenShareRole>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sharerName, setSharerName] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [kind, setKind] = useState<BroadcastKind | null>(null)
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment')

  const roleRef = useRef<ScreenShareRole>('idle')
  roleRef.current = role
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const videoSenderRef = useRef<RTCRtpSender | null>(null)
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])

  const iceServers = useRef<RTCIceServer[]>(buildIceServers())

  const closePeer = useCallback(() => {
    const peer = peerRef.current
    peerRef.current = null
    videoSenderRef.current = null
    pendingCandidatesRef.current = []
    if (!peer) return
    peer.onicecandidate = null
    peer.ontrack = null
    peer.onconnectionstatechange = null
    try {
      peer.close()
    } catch {
      /* kapanmış olabilir */
    }
  }, [])

  const createPeer = useCallback(
    (mode: 'send' | 'receive') => {
      const peer = new RTCPeerConnection({ iceServers: iceServers.current })

      peer.onicecandidate = (event) => {
        if (event.candidate) void send('rtc-ice', event.candidate.toJSON())
      }

      peer.ontrack = (event) => {
        const [stream] = event.streams
        if (stream) setRemoteStream(stream)
      }

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'failed') {
          setError(
            'Yayın bağlantısı kurulamadı. Ağ kısıtlaması (simetrik NAT/güvenlik duvarı) olabilir; ' +
              'bu durumda bir TURN sunucusu gerekir.',
          )
        }
      }

      if (mode === 'send') {
        const stream = localStreamRef.current
        if (stream) {
          for (const track of stream.getTracks()) {
            const sender = peer.addTrack(track, stream)
            if (track.kind === 'video') videoSenderRef.current = sender
          }
        }
      } else {
        peer.addTransceiver('video', { direction: 'recvonly' })
        peer.addTransceiver('audio', { direction: 'recvonly' })
      }

      peerRef.current = peer
      return peer
    },
    [send],
  )

  const stopSharing = useCallback(() => {
    const stream = localStreamRef.current
    localStreamRef.current = null
    for (const track of stream?.getTracks() ?? []) {
      track.onended = null
      track.stop()
    }
    setLocalStream(null)
    closePeer()
    setRole('idle')
    setSharerName(null)
    setKind(null)
    void send('screen-stop', null)
  }, [closePeer, send])

  const startSharing = useCallback(
    async (requested: BroadcastKind = 'screen') => {
      if (roleRef.current !== 'idle') return
      setError(null)

      const mode: BroadcastKind = requested === 'screen' && supportsScreen() ? 'screen' : 'camera'

      try {
        const stream =
          mode === 'screen'
            ? await captureScreen()
            : await captureCamera({ facingMode: cameraFacing, withAudio: true })

        localStreamRef.current = stream
        setLocalStream(stream)
        setRole('sharing')
        setSharerName(displayName)
        setKind(mode)
        setMicEnabled(stream.getAudioTracks().length > 0)

        for (const track of stream.getTracks()) {
          if (track.kind === 'video' && mode === 'screen') track.onended = () => stopSharing()
        }

        await send('screen-start', { name: displayName, kind: mode })

        const peer = createPeer('send')
        const offer = await peer.createOffer()
        await peer.setLocalDescription(offer)
        await send('rtc-offer', { sdp: peer.localDescription?.toJSON() ?? null })
      } catch (caught) {
        setError(broadcastErrorMessage(caught, mode))
        localStreamRef.current = null
        setLocalStream(null)
        setRole('idle')
        setSharerName(null)
        setKind(null)
      }
    },
    [cameraFacing, createPeer, displayName, send, stopSharing],
  )

  const switchCamera = useCallback(async () => {
    const stream = localStreamRef.current
    const sender = videoSenderRef.current
    if (!stream || !sender || roleRef.current !== 'sharing') return

    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment'
    try {
      const fresh = await captureCamera({ facingMode: nextFacing, withAudio: false })
      const newTrack = fresh.getVideoTracks()[0]
      const oldTrack = stream.getVideoTracks()[0]
      if (!newTrack || !oldTrack) return

      await sender.replaceTrack(newTrack)
      oldTrack.stop()

      const combined = new MediaStream([newTrack, ...stream.getAudioTracks()])
      localStreamRef.current = combined
      setLocalStream(combined)
      setCameraFacing(nextFacing)
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

  // --- Uzak taraf: el sıkışma -------------------------------------------------

  useEffect(() => {
    return on('screen-start', (signal) => {
      if (roleRef.current === 'sharing') return
      const data = signal.data as { name?: string; kind?: BroadcastKind } | null
      setRole('watching')
      setSharerName(data?.name?.slice(0, 40) ?? 'Katılımcı')
      setKind(data?.kind ?? 'screen')
      setError(null)
    })
  }, [on])

  useEffect(() => {
    return on('rtc-offer', (signal) => {
      void (async () => {
        if (roleRef.current === 'sharing') return
        const data = signal.data as { sdp?: RTCSessionDescriptionInit } | null
        if (!data?.sdp) return

        setRole('watching')
        closePeer()
        const peer = createPeer('receive')

        try {
          await peer.setRemoteDescription(new RTCSessionDescription(data.sdp))
          for (const candidate of pendingCandidatesRef.current) {
            await peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined)
          }
          pendingCandidatesRef.current = []

          const answer = await peer.createAnswer()
          await peer.setLocalDescription(answer)
          await send('rtc-answer', { sdp: peer.localDescription?.toJSON() ?? null })
        } catch {
          setError('Yayın el sıkışması tamamlanamadı.')
        }
      })()
    })
  }, [closePeer, createPeer, on, send])

  useEffect(() => {
    return on('rtc-answer', (signal) => {
      void (async () => {
        const peer = peerRef.current
        const data = signal.data as { sdp?: RTCSessionDescriptionInit } | null
        if (!peer || !data?.sdp) return
        try {
          await peer.setRemoteDescription(new RTCSessionDescription(data.sdp))
          for (const candidate of pendingCandidatesRef.current) {
            await peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined)
          }
          pendingCandidatesRef.current = []
        } catch {
          setError('Yayın yanıtı uygulanamadı.')
        }
      })()
    })
  }, [on])

  useEffect(() => {
    return on('rtc-ice', (signal) => {
      void (async () => {
        const candidate = signal.data as RTCIceCandidateInit | null
        if (!candidate) return
        const peer = peerRef.current
        if (!peer || !peer.remoteDescription) {
          pendingCandidatesRef.current.push(candidate)
          return
        }
        await peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined)
      })()
    })
  }, [on])

  useEffect(() => {
    return on('screen-stop', () => {
      if (roleRef.current === 'sharing') return
      closePeer()
      setRemoteStream(null)
      setRole('idle')
      setSharerName(null)
      setKind(null)
      setError(null)
    })
  }, [closePeer, on])

  useEffect(() => {
    return () => {
      const stream = localStreamRef.current
      for (const track of stream?.getTracks() ?? []) track.stop()
      localStreamRef.current = null
      peerRef.current?.close()
      peerRef.current = null
    }
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

/**
 * Ücretsiz herkese açık STUN sunucuları. TURN ayarları ortam değişkenleriyle
 * verilebilir (VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL);
 * kısıtlı ağlarda TURN olmadan bağlantı kurulamayabilir.
 */
function buildIceServers(): RTCIceServer[] {
  const env = import.meta.env
  const servers: RTCIceServer[] = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun.cloudflare.com:3478',
      ],
    },
  ]

  if (env.VITE_TURN_URL) {
    servers.push({
      urls: env.VITE_TURN_URL,
      username: env.VITE_TURN_USERNAME || undefined,
      credential: env.VITE_TURN_CREDENTIAL || undefined,
    })
  }

  return servers
}