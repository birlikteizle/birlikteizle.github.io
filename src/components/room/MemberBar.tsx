import { Crown } from 'lucide-react'
import type { RoomMember, RoomPresenceMap } from '@/types'
import { Avatar } from '@/components/ui/Avatar'

interface MemberBarProps {
  members: RoomMember[]
  presence: RoomPresenceMap
  selfUid: string
  adminUid: string
}

/**
 * Odadaki kişileri ve rollerini gösterir. Odayı kuran kişi yöneticidir ve
 * oynatmayı yalnızca o yönetir.
 */
export function MemberBar({ members, presence, selfUid, adminUid }: MemberBarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Katılımcılar
      </span>

      {members.map((member) => {
        const isAdmin = member.uid === adminUid
        const online = Boolean(presence[member.uid]?.online)

        return (
          <span
            key={member.uid}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] py-0.5 pl-0.5 pr-1.5"
          >
            <Avatar
              src={member.photoURL}
              name={member.displayName}
              size="xs"
              status={online ? 'online' : 'offline'}
            />
            <span className="max-w-[120px] truncate text-[11px] text-zinc-300">
              {member.displayName}
              {member.uid === selfUid ? ' (sen)' : ''}
            </span>

            {isAdmin ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300"
                title="Oda yöneticisi: oynatmayı yönetir"
              >
                <Crown className="h-2.5 w-2.5" />
                Yönetici
              </span>
            ) : null}
          </span>
        )
      })}

      <span className="text-[10px] text-zinc-600">
        Oynatmayı yalnızca odayı kuran yönetici yönetir.
      </span>
    </div>
  )
}