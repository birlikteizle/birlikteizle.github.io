import { Link } from 'react-router-dom'
import { ArrowLeft, LogOut, MessageCircle, UserPlus, Users } from 'lucide-react'
import type { RoomMember } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { shortRoomCode } from '@/lib/roomLink'

interface RoomHeaderProps {
  roomId: string
  self: RoomMember | null
  partner: RoomMember | null
  partnerOnline: boolean
  videoLabel: string
  onInvite: () => void
  onLeave: () => void
}

export function RoomHeader({
  roomId,
  self,
  partner,
  partnerOnline,
  videoLabel,
  onInvite,
  onLeave,
}: RoomHeaderProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Link
          to="/"
          aria-label="Ana sayfaya dön"
          title="Ana sayfa"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-400 transition hover:border-white/15 hover:bg-white/[0.06] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[14px] font-semibold text-zinc-100">
              Oda {shortRoomCode(roomId)}
            </h1>
            <span className="hidden items-center gap-1 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300 sm:inline-flex">
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              Canlı
            </span>
          </div>
          <p className="max-w-[46ch] truncate text-[10.5px] text-zinc-500">{videoLabel}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="flex items-center rounded-full border border-white/[0.07] bg-white/[0.03] py-1 pl-1.5 pr-2.5"
          title={partner ? `${partner.displayName} · ${partnerOnline ? 'çevrimiçi' : 'çevrimdışı'}` : 'Partner bekleniyor'}
        >
          <div className="flex -space-x-1.5">
            <Avatar src={self?.photoURL} name={self?.displayName ?? 'Sen'} size="xs" status="online" />
            {partner ? (
              <Avatar
                src={partner.photoURL}
                name={partner.displayName}
                size="xs"
                status={partnerOnline ? 'online' : 'offline'}
              />
            ) : (
              <span className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-white/20 bg-night-900 text-zinc-500 ring-2 ring-night-900">
                <Users className="h-3 w-3" />
              </span>
            )}
          </div>
          <span className="ml-1.5 hidden text-[10px] font-medium text-zinc-500 sm:inline">
            {partner ? (partnerOnline ? 'İki kişi çevrimiçi' : 'Partner çevrimdışı') : '1/2 kişi'}
          </span>
        </div>

        <Button variant="soft" size="sm" onClick={onInvite} className="h-9">
          <UserPlus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Davet et</span>
        </Button>

        {!partner ? (
          <span className="hidden items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-[10px] text-zinc-500 md:inline-flex">
            <MessageCircle className="h-3 w-3" />
            Oda hazır
          </span>
        ) : null}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onLeave}
          aria-label="Odadan ayrıl"
          title="Odadan ayrıl"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
