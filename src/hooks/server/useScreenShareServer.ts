import { useCallback, useEffect, useRef, useState } from 'react'
import { useRoomSignals } from '@/hooks/useRoomSignals'
import type { ScreenShareResult, ScreenShareRole } from '@/hooks/screenShareTypes'

/**
 * Sunucu modu: ekran paylaşımı sinyalleri SSE kanalından geçer, medya doğrudan
 * iki tarayıcı arasında kurulur (WebRTC).
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

  const roleRef = useRef<ScreenShareRole>('idle')
  roleRef.current = role
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])

  const iceServers = useRef<RTCIceServer[]>(buildIceServers())

  const closePeer = useCallback(() => {
    const peer = peerRef.current
    peerRef.current = null
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
            'Ekran paylaşımı bağlantısı kurulamadı. Ağ kısıtlaması (simetrik NAT/güvenlik duvarı) ' +
              'olabilir; bu durumda bir TURN sunucusu gerekir.',
          )
        }
      }

      if (mode === 'send') {
        const stream = localStreamRef.current
        if (stream) {
          for (const track of stream.getTracks()) peer.addTrack(track, stream)
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
    void send('screen-stop', null)
  }, [closePeer, send])

  const startSharing = useCallback(async () => {
    if (roleRef.current !== 'idle') return
    setError(null)

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      setError('Bu tarayıcı ekran paylaşımını desteklemiyor.')
      return
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError(
        'Ekran paylaşımı için güvenli bağlantı (https) gerekir. Sunucuyu alan adı + HTTPS ile ' +
          'yayınladıktan sonra tekrar dene.',
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

      await send('screen-start', { name: displayName })

      const peer = createPeer('send')
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      await send('rtc-offer', { sdp: peer.localDescription?.toJSON() ?? null })
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
  }, [createPeer, displayName, send, stopSharing])

  // --- Uzak taraf: el sıkışma -------------------------------------------------

  useEffect(() => {
    return on('screen-start', (signal) => {
      if (roleRef.current === 'sharing') return
      const data = signal.data as { name?: string } | null
      setRole('watching')
      setSharerName(data?.name?.slice(0, 40) ?? 'Partnerin')
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
          setError('Ekran paylaşımı el sıkışması tamamlanamadı.')
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
          setError('Ekran paylaşımı yanıtı uygulanamadı.')
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