import type { RoomMember, RoomPresenceMap } from '@/types'
import { Avatar } from '@/components/ui/Avatar'

interface MemberBarProps {
  members: RoomMember[]
  presence: RoomPresenceMap
  selfUid: string
}

/**
 * Odadaki kişileri ve çevrimiçi durumlarını gösterir.
 * Oynatma kontrolü odadaki herkes için eşittir.
 */
export function MemberBar({ members, presence, selfUid }: MemberBarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Katılımcılar
      </span>

      {members.map((member) => {
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
            <span className="max-w-[140px] truncate text-[11px] text-zinc-300">
              {member.displayName}
              {member.uid === selfUid ? ' (sen)' : ''}
            </span>
          </span>
        )
      })}

      <span className="text-[10px] text-zinc-600">
        Oynatmayı odadaki herkes yönetebilir.
      </span>
    </div>
  )
}