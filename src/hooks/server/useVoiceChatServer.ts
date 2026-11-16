import { useCallback, useEffect, useRef, useState } from 'react'
import { useRoomSignals } from '@/hooks/useRoomSignals'
import { voiceErrorMessage, type VoiceChatResult, type VoicePeer } from '@/hooks/voiceChatTypes'

interface ServerPeer {
  pc: RTCPeerConnection
  uid: string
  name: string
  stream: MediaStream | null
  mic: boolean
  cam: boolean
  videoSender: RTCRtpSender | null
}

/** Sinyal kanalından taşınan sesli sohbet mesajları. */
type VoiceMessage =
  | { kind: 'hello'; name: string; mic: boolean; cam: boolean }
  | { kind: 'offer'; to: string; sdp: RTCSessionDescriptionInit; name: string }
  | { kind: 'answer'; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: 'ice'; to: string; candidate: RTCIceCandidateInit }
  | { kind: 'state'; name: string; mic: boolean; cam: boolean }
  | { kind: 'bye' }

/**
 * Sunucu modu sesli sohbet.
 *
 * Herkes herkesle doğrudan bağlanır (mesh). Kimin teklif göndereceği kimlik
 * sırasına göre belirlenir, böylece iki taraf aynı anda teklif göndermez.
 * Mikrofon ve kamera kapalı başlar.
 */
export function useVoiceChatServer(
  roomId: string,
  uid: string,
  displayName: string,
): VoiceChatResult {
  const { on, send } = useRoomSignals(roomId, uid)

  const [inVoice, setInVoice] = useState(false)
  const [micEnabled, setMicEnabled] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<VoicePeer[]>([])
  const [error, setError] = useState<string | null>(null)

  const localStreamRef = useRef<MediaStream | null>(null)
  const inVoiceRef = useRef(false)
  inVoiceRef.current = inVoice
  const peersRef = useRef(new Map<string, ServerPeer>())
  const pendingIceRef = useRef(new Map<string, RTCIceCandidateInit[]>())
  const iceServers = useRef<RTCIceServer[]>(buildIceServers())

  const publish = useCallback(() => {
    setPeers(
      [...peersRef.current.values()].map((peer) => ({
        id: peer.uid,
        uid: peer.uid,
        name: peer.name,
        stream: peer.stream,
        micOn: peer.mic,
        camOn: peer.cam,
      })),
    )
  }, [])

  const sendVoice = useCallback(
    (message: VoiceMessage) => {
      void send('voice', message)
    },
    [send],
  )

  const attachLocalTracks = useCallback((pc: RTCPeerConnection, peer: ServerPeer) => {
    const stream = localStreamRef.current
    if (!stream) return

    for (const track of stream.getAudioTracks()) {
      pc.addTrack(track, stream)
    }

    // Video kanalı önceden açılır; kamera sonradan replaceTrack ile bağlanır,
    // böylece yeniden anlaşma (renegotiation) gerekmez.
    const transceiver = pc.addTransceiver('video', { direction: 'sendrecv' })
    peer.videoSender = transceiver.sender
    const videoTrack = stream.getVideoTracks()[0] ?? null
    void transceiver.sender.replaceTrack(videoTrack)
  }, [])

  const createPeer = useCallback(
    (peerUid: string, name: string): ServerPeer => {
      const pc = new RTCPeerConnection({ iceServers: iceServers.current })
      const peer: ServerPeer = {
        pc,
        uid: peerUid,
        name,
        stream: null,
        mic: true,
        cam: false,
        videoSender: null,
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendVoice({ kind: 'ice', to: peerUid, candidate: event.candidate.toJSON() })
        }
      }

      pc.ontrack = (event) => {
        // `addTransceiver` ile açılan video kanalı bir MediaStream'e bağlı
        // olmadığı için `event.streams` boş gelebilir. Bu durumda kanalı kendi
        // akışımıza ekliyoruz; aksi halde kamera görüntüsü hiç görünmüyordu.
        const [remoteStream] = event.streams
        if (remoteStream) {
          peer.stream = remoteStream
        } else {
          const stream = peer.stream ?? new MediaStream()
          if (!stream.getTracks().includes(event.track)) stream.addTrack(event.track)
          peer.stream = stream
        }
        publish()
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setError(
            'Sesli sohbet bağlantısı kurulamadı. Ağ kısıtlaması olabilir; TURN sunucusu gerekebilir.',
          )
        }
      }

      attachLocalTracks(pc, peer)
      peersRef.current.set(peerUid, peer)
      pendingIceRef.current.set(peerUid, [])
      publish()
      return peer
    },
    [attachLocalTracks, publish, sendVoice],
  )

  const dropPeer = useCallback(
    (peerUid: string) => {
      const peer = peersRef.current.get(peerUid)
      if (!peer) return
      peer.pc.onicecandidate = null
      peer.pc.ontrack = null
      peer.pc.onconnectionstatechange = null
      try {
        peer.pc.close()
      } catch {
        /* kapanmış olabilir */
      }
      peersRef.current.delete(peerUid)
      pendingIceRef.current.delete(peerUid)
      publish()
    },
    [publish],
  )

  const flushIce = useCallback(async (peerUid: string, pc: RTCPeerConnection) => {
    const pending = pendingIceRef.current.get(peerUid) ?? []
    for (const candidate of pending) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined)
    }
    pendingIceRef.current.set(peerUid, [])
  }, [])

  /* ---------------------------------------------------------------- */
  /* Gelen mesajlar                                                    */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    return on('voice', (signal) => {
      const message = signal.data as (VoiceMessage & { from: string }) | null
      if (!message || !('kind' in message)) return

      const from = signal.from
      if (!from || from === uid) return

      // Bana yönelik olmayan mesajlar yok sayılır.
      if ('to' in message && message.to && message.to !== uid) return

      void (async () => {
        switch (message.kind) {
          case 'hello': {
            if (!inVoiceRef.current) return
            const existing = peersRef.current.get(from)
            if (existing) {
              existing.name = message.name
              existing.mic = message.mic
              existing.cam = message.cam
              publish()
              return
            }
            // Kimlik sırası: büyük olan teklif gönderir.
            if (uid > from) {
              const peer = createPeer(from, message.name)
              const offer = await peer.pc.createOffer()
              await peer.pc.setLocalDescription(offer)
              sendVoice({
                kind: 'offer',
                to: from,
                sdp: peer.pc.localDescription?.toJSON() ?? offer,
                name: displayName,
              })
            } else {
              const peer = createPeer(from, message.name)
              peer.mic = message.mic
              peer.cam = message.cam
              publish()
            }
            break
          }
          case 'offer': {
            if (!inVoiceRef.current) return
            const peer = peersRef.current.get(from) ?? createPeer(from, message.name || 'Katılımcı')
            await peer.pc.setRemoteDescription(new RTCSessionDescription(message.sdp))
            await flushIce(from, peer.pc)
            const answer = await peer.pc.createAnswer()
            await peer.pc.setLocalDescription(answer)
            sendVoice({ kind: 'answer', to: from, sdp: peer.pc.localDescription?.toJSON() ?? answer })
            break
          }
          case 'answer': {
            const peer = peersRef.current.get(from)
            if (!peer) return
            await peer.pc.setRemoteDescription(new RTCSessionDescription(message.sdp))
            await flushIce(from, peer.pc)
            break
          }
          case 'ice': {
            const peer = peersRef.current.get(from)
            if (!peer) {
              const queue = pendingIceRef.current.get(from) ?? []
              queue.push(message.candidate)
              pendingIceRef.current.set(from, queue)
              return
            }
            if (!peer.pc.remoteDescription) {
              const queue = pendingIceRef.current.get(from) ?? []
              queue.push(message.candidate)
              pendingIceRef.current.set(from, queue)
              return
            }
            await peer.pc.addIceCandidate(new RTCIceCandidate(message.candidate)).catch(() => undefined)
            break
          }
          case 'state': {
            const peer = peersRef.current.get(from)
            if (!peer) return
            peer.name = message.name || peer.name
            peer.mic = message.mic
            peer.cam = message.cam
            publish()
            break
          }
          case 'bye': {
            dropPeer(from)
            break
          }
        }
      })()
    })
  }, [createPeer, displayName, dropPeer, flushIce, on, publish, sendVoice, uid])

  /* ---------------------------------------------------------------- */
  /* Eylemler                                                          */
  /* ---------------------------------------------------------------- */

  const join = useCallback(async () => {
    if (inVoiceRef.current) return
    setError(null)

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Bu tarayıcı sesli sohbeti desteklemiyor.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream
      setLocalStream(stream)
      setInVoice(true)
      setMicEnabled(true)
      setCameraEnabled(false)
      sendVoice({ kind: 'hello', name: displayName, mic: true, cam: false })
    } catch (caught) {
      setError(voiceErrorMessage(caught))
    }
  }, [displayName, sendVoice])

  const leave = useCallback(() => {
    const stream = localStreamRef.current
    for (const track of stream?.getTracks() ?? []) track.stop()
    localStreamRef.current = null
    setLocalStream(null)
    setInVoice(false)
    setMicEnabled(false)
    setCameraEnabled(false)
    for (const peerUid of [...peersRef.current.keys()]) dropPeer(peerUid)
    sendVoice({ kind: 'bye' })
  }, [dropPeer, sendVoice])

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const tracks = stream.getAudioTracks()
    if (tracks.length === 0) return
    const next = !tracks.some((track) => track.enabled)
    for (const track of tracks) track.enabled = next
    setMicEnabled(next)
    sendVoice({ kind: 'state', name: displayName, mic: next, cam: cameraEnabled })
  }, [cameraEnabled, displayName, sendVoice])

  const toggleCamera = useCallback(async () => {
    const stream = localStreamRef.current
    if (!stream) return
    setError(null)

    try {
      if (cameraEnabled) {
        for (const track of stream.getVideoTracks()) track.stop()
        for (const peer of peersRef.current.values()) {
          await peer.videoSender?.replaceTrack(null)
        }
        const audioOnly = new MediaStream(stream.getAudioTracks())
        localStreamRef.current = audioOnly
        setLocalStream(audioOnly)
        setCameraEnabled(false)
        sendVoice({ kind: 'state', name: displayName, mic: micEnabled, cam: false })
        return
      }

      const camera = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } },
      })
      const videoTrack = camera.getVideoTracks()[0]
      if (!videoTrack) return

      for (const peer of peersRef.current.values()) {
        await peer.videoSender?.replaceTrack(videoTrack)
      }
      const combined = new MediaStream([...stream.getAudioTracks(), videoTrack])
      localStreamRef.current = combined
      setLocalStream(combined)
      setCameraEnabled(true)
      sendVoice({ kind: 'state', name: displayName, mic: micEnabled, cam: true })
    } catch (caught) {
      setError(voiceErrorMessage(caught))
    }
  }, [cameraEnabled, displayName, micEnabled, sendVoice])

  useEffect(() => {
    return () => {
      const stream = localStreamRef.current
      for (const track of stream?.getTracks() ?? []) track.stop()
      localStreamRef.current = null
      for (const peer of peersRef.current.values()) peer.pc.close()
      peersRef.current.clear()
    }
  }, [])

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