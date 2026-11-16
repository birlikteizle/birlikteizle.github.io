import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArchiveX,
  Home,
  RefreshCw,
  SearchX,
  UsersRound,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { shortRoomCode } from '@/lib/roomLink'
import { isValidRoomId } from '@/lib/ids'

export type RoomStateKind = 'not-found' | 'full' | 'closed' | 'error'

const META: Record<
  RoomStateKind,
  { icon: typeof SearchX; title: string; description: string; tone: string }
> = {
  'not-found': {
    icon: SearchX,
    title: 'Oda bulunamadı',
    description:
      'Bu oda kimliğiyle bir oda yok ya da bağlantı eksik kopyalanmış. Davet bağlantısını gönderen kişiden tekrar isteyebilirsin.',
    tone: 'text-zinc-300 border-white/10 bg-white/[0.04]',
  },
  full: {
    icon: UsersRound,
    title: 'Bu oda dolu',
    description:
      'Odalar en fazla iki kişiliktir ve bu odada iki üye zaten var. Üçüncü bir kişi katılamaz. Yeni bir oda oluşturabilir veya kendi davetini paylaşabilirsin.',
    tone: 'text-amber-300 border-amber-400/20 bg-amber-400/[0.07]',
  },
  closed: {
    icon: ArchiveX,
    title: 'Oda artık etkin değil',
    description:
      'Bu oda kapatılmış. Var olan mesajlar ve oynatma durumu artık bu oturumda kullanılamıyor.',
    tone: 'text-zinc-300 border-white/10 bg-white/[0.04]',
  },
  error: {
    icon: AlertTriangle,
    title: 'Odaya bağlanılamadı',
    description:
      'Bağlantı sırasında beklenmeyen bir hata oluştu. İnternet bağlantını kontrol edip tekrar deneyebilirsin.',
    tone: 'text-rose-300 border-rose-400/20 bg-rose-400/[0.07]',
  },
}

interface RoomStateScreenProps {
  kind: RoomStateKind
  roomId?: string
  message?: string | null
}

export function RoomStateScreen({ kind, roomId, message }: RoomStateScreenProps) {
  const navigate = useNavigate()
  const meta = META[kind]
  const Icon = meta.icon

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center py-10 text-center">
      <span className={`grid h-16 w-16 place-items-center rounded-2xl border ${meta.tone}`}>
        <Icon className="h-7 w-7" />
      </span>
      <h1 className="mt-5 font-display text-2xl font-semibold text-zinc-50">{meta.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        {kind === 'error' && message ? message : meta.description}
      </p>

      {roomId && isValidRoomId(roomId) ? (
        <code className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-zinc-500">
          Oda {shortRoomCode(roomId)}
        </code>
      ) : null}

      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
        <Button variant="primary" onClick={() => navigate('/')}>
          <Home className="h-4 w-4" />
          Ana sayfaya dön
        </Button>
        {kind === 'error' ? (
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
            Tekrar dene
          </Button>
        ) : null}
        {kind === 'full' ? (
          <Button variant="secondary" onClick={() => navigate('/#studio')}>
            Yeni oda oluştur
          </Button>
        ) : null}
      </div>

      {kind === 'not-found' ? (
        <p className="mt-6 text-[11px] leading-relaxed text-zinc-600">
          Oda kimlikleri 22 karakterlik rastgele kodlardır. Elle tahmin edilerek oda oluşturulamaz;
          yalnızca geçerli bir davet bağlantısıyla var olan bir odaya katılabilirsin.
        </p>
      ) : null}
    </div>
  )
}
