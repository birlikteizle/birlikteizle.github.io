import { Crown, ShieldCheck, ShieldMinus, ShieldPlus } from 'lucide-react'
import type { RoomMember, RoomPresenceMap } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

interface MemberBarProps {
  members: RoomMember[]
  presence: RoomPresenceMap
  selfUid: string
  adminUid: string
  managers: string[]
  /** Yalnızca oda yöneticisi yetki verip alabilir. */
  canGrant: boolean
  onToggleManager: (uid: string, grant: boolean) => Promise<void>
}

/**
 * Odadaki kişileri ve rollerini gösterir. Oda yöneticisi buradan başkalarına
 * oynatma yetkisi verip geri alabilir.
 */
export function MemberBar({
  members,
  presence,
  selfUid,
  adminUid,
  managers,
  canGrant,
  onToggleManager,
}: MemberBarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Katılımcılar
      </span>

      {members.map((member) => {
        const isAdmin = member.uid === adminUid
        const isManager = managers.includes(member.uid)
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
                title="Oda yöneticisi: oynatmayı yönetir ve yetki verebilir"
              >
                <Crown className="h-2.5 w-2.5" />
                Yönetici
              </span>
            ) : isManager ? (
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300"
                title="Yönetici bu kişiye oynatma yetkisi verdi"
              >
                <ShieldCheck className="h-2.5 w-2.5" />
                Yetkili
              </span>
            ) : null}

            {canGrant && !isAdmin ? (
              <button
                type="button"
                onClick={() => void onToggleManager(member.uid, !isManager)}
                className={cn(
                  'ml-0.5 inline-flex h-5 items-center gap-0.5 rounded-full px-1.5 text-[9px] font-semibold transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400',
                  isManager
                    ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                    : 'bg-brand-500/15 text-brand-200 hover:bg-brand-500/25',
                )}
                title={isManager ? 'Yetkiyi geri al' : 'Oynatma yetkisi ver'}
              >
                {isManager ? (
                  <ShieldMinus className="h-2.5 w-2.5" />
                ) : (
                  <ShieldPlus className="h-2.5 w-2.5" />
                )}
                {isManager ? 'Yetkiyi al' : 'Yetki ver'}
              </button>
            ) : null}
          </span>
        )
      })}

      {canGrant ? (
        <span className="text-[10px] text-zinc-600">
          Yetki verdiğin kişiler de oynat/duraklat, sarma ve kaynak değiştirme yapabilir.
        </span>
      ) : null}
    </div>
  )
}