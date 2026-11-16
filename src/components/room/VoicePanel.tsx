import { useEffect, useRef } from 'react'
import { Mic, MicOff, PhoneOff, Video, VideoOff, Volume2 } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { useVoiceChat } from '@/hooks/useVoiceChat'
import { cn } from '@/lib/utils'

interface VoicePanelProps {
  roomId: string
  uid: string
  displayName: string
  isOnline: boolean
}

/** Uzak katılımcının sesini çalar (görüntü varsa kutuda gösterilir). */
function RemoteMedia({ stream, name, camOn }: { stream: MediaStream | null; name: string; camOn: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (audio && audio.srcObject !== stream) audio.srcObject = stream ?? null
    const video = videoRef.current
    if (video && video.srcObject !== stream) video.srcObject = stream ?? null
    void audio?.play().catch(() => undefined)
  }, [stream])

  // Yalnızca kamerası açık olanlarda görüntü gösterilir.
  if (!camOn || !stream?.getVideoTracks().length) {
    return (
      <div className="flex w-24 flex-col items-center gap-1.5">
        <Avatar name={name} size="lg" />
        <span className="max-w-full truncate text-[10px] text-zinc-400">{name}</span>
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      </div>
    )
  }

  return (
    <div className="relative w-40 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-black">
      <video ref={videoRef} autoPlay playsInline muted={false} className="h-24 w-full object-cover" />
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      <span className="absolute bottom-1 left-1.5 max-w-[90%] truncate rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-zinc-200">
        {name}
      </span>
    </div>
  )
}

/**
 * Sesli sohbet paneli. Mikrofon ve kamera kapalı başlar; kullanıcı istediğinde
 * açar. Görüntü ve ses doğrudan cihazlar arasında gider.
 */
export function VoicePanel({ roomId, uid, displayName, isOnline }: VoicePanelProps) {
  const { inVoice, micEnabled, cameraEnabled, localStream, peers, error, join, leave, toggleMic, toggleCamera } =
    useVoiceChat(roomId, uid, displayName)

  const micTracks = localStream?.getAudioTracks() ?? []

  return (
    <section className="panel mb-3 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Volume2 className="h-4 w-4 text-emerald-300" />
            Sesli sohbet
            {inVoice ? (
              <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                Bağlı
              </span>
            ) : null}
          </h2>
          <p className="mt-1 text-[10.5px] leading-relaxed text-zinc-500">
            {inVoice
              ? 'Mikrofon ve kamera kapalı başlar; istediğin an açabilirsin. Ses ve görüntü doğrudan cihazlar arasında gider.'
              : 'Katıldığında tarayıcı mikrofon izni ister. Kamera kapalı başlar, istersen açarsın.'}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {inVoice ? (
            <>
              <button
                type="button"
                onClick={toggleMic}
                aria-label={micEnabled ? 'Mikrofonu kapat' : 'Mikrofonu aç'}
                title={micEnabled ? 'Mikrofonu kapat' : 'Mikrofonu aç'}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                  micEnabled && micTracks.length > 0
                    ? 'border-white/[0.08] bg-white/[0.05] text-zinc-200 hover:bg-white/[0.09]'
                    : 'border-rose-400/20 bg-rose-500/15 text-rose-300',
                )}
              >
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => void toggleCamera()}
                aria-label={cameraEnabled ? 'Kamerayı kapat' : 'Kamerayı aç'}
                title={cameraEnabled ? 'Kamerayı kapat' : 'Kamerayı aç'}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                  cameraEnabled
                    ? 'border-white/[0.08] bg-white/[0.05] text-zinc-200 hover:bg-white/[0.09]'
                    : 'border-white/[0.08] bg-white/[0.03] text-zinc-500 hover:bg-white/[0.07]',
                )}
              >
                {cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </button>

              <Button variant="ghost" size="sm" onClick={leave}>
                <PhoneOff className="h-3.5 w-3.5" />
                Ayrıl
              </Button>
            </>
          ) : (
            <Button
              variant="soft"
              size="sm"
              disabled={!isOnline}
              onClick={() => void join()}
            >
              <Mic className="h-3.5 w-3.5" />
              Sese katıl
            </Button>
          )}
        </div>
      </div>

      {inVoice ? (
        <div className="mt-3 flex flex-wrap items-start gap-2.5">
          <div className="flex w-24 flex-col items-center gap-1.5">
            {cameraEnabled && localStream ? (
              <video
                autoPlay
                playsInline
                muted
                ref={(element) => {
                  if (element && element.srcObject !== localStream) element.srcObject = localStream
                }}
                className="h-16 w-24 rounded-xl border border-brand-400/30 object-cover"
              />
            ) : (
              <Avatar name={`${displayName} (sen)`} size="lg" status="online" />
            )}
            <span className="max-w-full truncate text-[10px] text-zinc-400">{displayName} (sen)</span>
            <span className="text-[9px] text-zinc-600">
              {micEnabled ? 'mikrofon açık' : 'mikrofon kapalı'}
            </span>
          </div>

          {peers.map((peer) => (
            <div key={peer.id} className="flex flex-col items-center gap-1">
              <RemoteMedia stream={peer.stream} name={peer.name} camOn={peer.camOn} />
              <span className="text-[9px] text-zinc-600">
                {peer.micOn ? 'mikrofon açık' : 'mikrofon kapalı'}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-amber-400/15 bg-amber-400/[0.06] px-2.5 py-2 text-[11px] leading-relaxed text-amber-200/90">
          {error}
        </p>
      ) : null}
    </section>
  )
}