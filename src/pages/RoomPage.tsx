import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { AppUser } from '@/types'
import {
  AlertTriangle,
  Loader2,
  MessageCircle,
  MonitorPlay,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  WifiOff,
} from 'lucide-react'
import type { RoomInfo, RoomMember, RoomMembers, RoomPresenceMap } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { useConnection } from '@/context/ConnectionContext'
import { useToast } from '@/context/ToastContext'
import { useRoomSession } from '@/hooks/useRoomSession'
import { usePlayback } from '@/hooks/usePlayback'
import { useMessages } from '@/hooks/useMessages'
import { PageShell } from '@/components/layout/PageShell'
import { RoomHeader } from '@/components/room/RoomHeader'
import { MemberBar } from '@/components/room/MemberBar'
import { VoicePanel } from '@/components/room/VoicePanel'
import { VideoStage } from '@/components/room/VideoStage'
import { SourceBar } from '@/components/room/SourceBar'
import { ScreenSharePanel } from '@/components/room/ScreenSharePanel'
import { ChatPanel } from '@/components/room/ChatPanel'
import { InviteModal } from '@/components/room/InviteModal'
import { RoomStateScreen, type RoomStateKind } from '@/components/room/RoomStateScreen'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Spinner'
import { parseVideoUrl, providerDisplayName } from '@/lib/video'
import { isP2P } from '@/lib/mode'
import { DEFAULT_CAPACITY } from '@/lib/capacity'
import { shortRoomCode } from '@/lib/roomLink'
import { saveRecentRoom } from '@/lib/recentRooms'
import { cn } from '@/lib/utils'

type MobileTab = 'video' | 'chat'

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user } = useAuth()

  if (!user) return null

  return <RoomGate roomId={roomId} user={user} />
}

function RoomGate({ roomId, user }: { roomId: string | undefined; user: AppUser }) {
  const session = useRoomSession(roomId, user)

  if (session.status === 'validating') {
    return (
      <PageShell>
        <RoomLoading />
      </PageShell>
    )
  }

  if (session.status === 'ready' && roomId) {
    return (
      <RoomReady
        roomId={roomId}
        user={user}
        info={session.info}
        members={session.members}
        presence={session.presence}
      />
    )
  }

  const kind: RoomStateKind =
    session.status === 'full' || session.status === 'closed' || session.status === 'not-found'
      ? session.status
      : 'error'

  return (
    <PageShell>
      <RoomStateScreen kind={kind} roomId={roomId} message={session.error} />
    </PageShell>
  )
}

function RoomReady({
  roomId,
  user,
  info,
  members,
  presence,
}: {
  roomId: string
  user: AppUser
  info: RoomInfo | null
  members: RoomMembers
  presence: RoomPresenceMap
}) {
  const navigate = useNavigate()
  const { pushToast } = useToast()
  const { status: connectionStatus, isOnline } = useConnection()

  const {
    playback,
    loading: playbackLoading,
    error: playbackError,
    publish,
    serverOffset,
    syncNonce,
    lastLocalCommandIdRef,
  } = usePlayback(roomId, user.uid)

  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    retry: retryMessages,
  } = useMessages(roomId)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<MobileTab>('video')
  const [focusToken, setFocusToken] = useState(0)
  const [seenCount, setSeenCount] = useState(0)

  const firstMessagesLoadRef = useRef(true)

  const memberList = useMemo(
    () => Object.values(members).filter((member): member is RoomMember => Boolean(member?.uid)),
    [members],
  )
  const partner = memberList.find((member) => member.uid !== user.uid) ?? null
  const othersOnline = memberList.filter(
    (member) => member.uid !== user.uid && presence[member.uid]?.online,
  ).length

  const parsedPlayback = useMemo(
    () => (playback?.sourceUrl ? parseVideoUrl(playback.sourceUrl) : null),
    [playback?.sourceUrl],
  )

  const videoLabel =
    !playback || playback.provider === 'none' || !playback.sourceUrl
      ? 'Henüz video eklenmedi'
      : parsedPlayback?.ok
        ? `${parsedPlayback.providerLabel} · ${parsedPlayback.title}`
        : providerDisplayName(playback.provider)

  useEffect(() => {
    const previousTitle = document.title
    document.title = `Oda ${shortRoomCode(roomId)} · Birlikte İzle`
    return () => {
      document.title = previousTitle
    }
  }, [roomId])

  useEffect(() => {
    if (!playback) return
    saveRecentRoom({
      id: roomId,
      provider: playback.provider,
      title: parsedPlayback?.ok ? parsedPlayback.title : 'Boş oda',
    })
    // Oda yalnızca oynatma kaynağı değiştiğinde geçmişe yazılır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, playback?.sourceUrl, playback?.provider])

  useEffect(() => {
    if (firstMessagesLoadRef.current) {
      if (messagesLoading) return
      firstMessagesLoadRef.current = false
      setSeenCount(messages.length)
      return
    }

    if (activeTab === 'chat') setSeenCount(messages.length)
  }, [activeTab, messages.length, messagesLoading])

  const unread = activeTab === 'chat' ? 0 : Math.max(0, messages.length - seenCount)

  const handleRequestAddVideo = () => {
    setActiveTab('video')
    setFocusToken((value) => value + 1)
  }

  const handleLeave = () => {
    navigate('/')
    pushToast({
      kind: 'info',
      title: 'Odadan ayrıldın',
      description: 'Üyeliğin korunuyor. Aynı davet bağlantısıyla istediğin zaman geri dönebilirsin.',
    })
  }

  return (
    <PageShell className="pt-5 sm:pt-7">
      <RoomHeader
        roomId={roomId}
        members={memberList}
        presence={presence}
        capacity={info?.capacity ?? DEFAULT_CAPACITY}
        videoLabel={videoLabel}
        onInvite={() => setInviteOpen(true)}
        onLeave={handleLeave}
      />

      {memberList.length > 1 ? (
        <MemberBar members={memberList} presence={presence} selfUid={user.uid} />
      ) : null}

      {isP2P ? (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-zinc-400">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <span>
            <strong className="font-semibold text-zinc-300">Sunucusuz mod:</strong> bağlantı doğrudan
            tarayıcılar arasında kurulur. Oda ve mesajlar kalıcı değildir; iki taraf da çıktığında oda
            sona erer. İkiniz de aynı anda çevrimiçi olmalısınız.
          </span>
        </div>
      ) : null}

      {connectionStatus !== 'online' ? (
        <div
          role="status"
          className="mb-3 flex items-start gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/90"
        >
          {isOnline ? (
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <div>
            <p className="font-semibold">
              {isOnline ? 'Sunucuya yeniden bağlanılıyor…' : 'İnternet bağlantısı yok'}
            </p>
            <p className="mt-0.5 text-amber-200/60">
              {isOnline
                ? 'Kontroller bağlantı kurulunca yeniden etkinleşecek. Mevcut video oynamaya devam eder.'
                : 'Kontroller çevrimdışıyken devre dışıdır. Bağlantı gelince oda durumu yeniden eşitlenir.'}
            </p>
          </div>
        </div>
      ) : null}

      {playbackError ? (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-400/20 bg-rose-500/[0.08] px-3 py-2.5 text-[11px] text-rose-200"
        >
          <span className="inline-flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {playbackError}
          </span>
          <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Yenile
          </Button>
        </div>
      ) : null}

      {memberList.length <= 1 ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-400/15 bg-brand-500/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-brand-100/80">
          <span className="inline-flex items-start gap-2">
            <UserPlus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" />
            Henüz başka katılımcı yok. Davet bağlantısını paylaştığında katılan herkes aynı odada
            aynı anda izler.
          </span>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="rounded-md px-1 font-semibold text-brand-200 underline decoration-brand-400/40 underline-offset-2 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            Davet bağlantısını göster
          </button>
        </div>
      ) : null}

      <div
        role="tablist"
        aria-label="Oda görünümü"
        className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1 lg:hidden"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'video'}
          onClick={() => setActiveTab('video')}
          className={cn(
            'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
            activeTab === 'video'
              ? 'bg-white/[0.08] text-zinc-100 shadow-inner-line'
              : 'text-zinc-500 hover:text-zinc-300',
          )}
        >
          <MonitorPlay className="h-3.5 w-3.5" />
          Video
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'chat'}
          onClick={() => setActiveTab('chat')}
          className={cn(
            'relative inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
            activeTab === 'chat'
              ? 'bg-white/[0.08] text-zinc-100 shadow-inner-line'
              : 'text-zinc-500 hover:text-zinc-300',
          )}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Sohbet
          {unread > 0 ? (
            <span className="ml-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-brand-gradient px-1 text-[9px] font-bold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_366px] lg:items-start">
        <div className={cn('min-w-0 space-y-3', activeTab === 'chat' && 'hidden lg:block')}>
          <VoicePanel
            roomId={roomId}
            uid={user.uid}
            displayName={user.displayName?.trim() || 'Kullanıcı'}
            isOnline={isOnline}
          />

          <ScreenSharePanel
            roomId={roomId}
            uid={user.uid}
            displayName={user.displayName?.trim() || 'Kullanıcı'}
            partnerName={partner?.displayName ?? null}
            isOnline={isOnline}
          />

          <VideoStage
            roomId={roomId}
            uid={user.uid}
            
            playback={playback}
            loading={playbackLoading}
            playbackError={playbackError}
            publish={publish}
            serverOffset={serverOffset}
            syncNonce={syncNonce}
            isOnline={isOnline}
            lastLocalCommandIdRef={lastLocalCommandIdRef}
            onRequestAddVideo={handleRequestAddVideo}
          />

          <SourceBar
            playback={playback}
            publish={publish}
            isOnline={isOnline}
            
            focusToken={focusToken}
          />
        </div>

        <div className={cn('min-w-0', activeTab === 'video' && 'hidden lg:block')}>
          <ChatPanel
            roomId={roomId}
            user={user}
            messages={messages}
            loading={messagesLoading}
            error={messagesError}
            onRetry={retryMessages}
            othersOnline={othersOnline}
            othersTotal={Math.max(0, memberList.length - 1)}
            className="h-[calc(100dvh-15rem)] min-h-[360px] lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)] lg:min-h-[480px]"
          />
        </div>
      </div>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        roomId={roomId}
        memberCount={memberList.length}
        capacity={info?.capacity ?? DEFAULT_CAPACITY}
        adminUid={info?.createdBy ?? ''}
        visibility={info?.visibility ?? 'public'}
      />
    </PageShell>
  )
}

function RoomLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2.5 w-40" />
          </div>
        </div>
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_366px]">
        <div className="space-y-3">
          <Skeleton className="aspect-video w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
        <Skeleton className="hidden h-[480px] rounded-3xl lg:block" />
      </div>
      <p className="mt-5 flex items-center justify-center gap-2 text-xs text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin text-brand-300" />
        Odaya bağlanılıyor…
      </p>
    </div>
  )
}
