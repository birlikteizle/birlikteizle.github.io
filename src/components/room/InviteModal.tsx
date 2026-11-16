import { useEffect, useState } from 'react'
import { Check, Copy, Link2, Share2, ShieldCheck, Users } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/context/ToastContext'
import { buildRoomUrl, shortRoomCode } from '@/lib/roomLink'
import { copyText } from '@/lib/utils'

interface InviteModalProps {
  open: boolean
  onClose: () => void
  roomId: string
  memberCount: number
  capacity: number
}

export function InviteModal({
  open,
  onClose,
  roomId,
  memberCount,
  capacity,
}: InviteModalProps) {
  const { pushToast } = useToast()
  const [copied, setCopied] = useState(false)
  const [copying, setCopying] = useState(false)

  // Kapasite bağlantıya gömülür: sunucusuz modda katılan herkes aynı sınırı kullanır.
  const roomUrl = typeof window === 'undefined' ? '' : buildRoomUrl(roomId, capacity)
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    if (!open) {
      setCopied(false)
      setCopying(false)
    }
  }, [open])

  const handleCopy = async () => {
    if (!roomUrl || copying) return
    setCopying(true)
    const ok = await copyText(roomUrl)
    setCopying(false)

    if (ok) {
      setCopied(true)
      pushToast({ kind: 'success', title: 'Davet bağlantısı kopyalandı' })
      window.setTimeout(() => setCopied(false), 2200)
    } else {
      pushToast({
        kind: 'warning',
        title: 'Bağlantı kopyalanamadı',
        description: 'Adres alanını seçip elle kopyalayabilirsin.',
      })
    }
  }

  const handleShare = async () => {
    if (!canNativeShare || !roomUrl) return
    try {
      await navigator.share({
        title: 'Birlikte İzle',
        text: 'Birlikte video izleyelim. Bu bağlantıya katıl:',
        url: roomUrl,
      })
    } catch (error) {
      if ((error as { name?: string }).name !== 'AbortError') {
        pushToast({ kind: 'warning', title: 'Paylaşım açılamadı' })
      }
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Arkadaşlarını odaya davet et"
      description={`Oda ${capacity} kişilik. Bağlantıyı paylaş; kapasite dolduğunda yeni katılım engellenir.`}
      footer={
        <>
          {canNativeShare ? (
            <Button variant="outline" onClick={() => void handleShare()}>
              <Share2 className="h-4 w-4" />
              Paylaş
            </Button>
          ) : null}
          <Button variant="primary" onClick={() => void handleCopy()}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Kopyalandı' : 'Bağlantıyı kopyala'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <Users className="h-3.5 w-3.5 text-brand-300" />
            {memberCount > 1 ? (
              <span>
                Odada <span className="font-medium text-zinc-200">{memberCount} kişi</span> var ·{' '}
                {Math.max(0, capacity - memberCount)} yer boş
              </span>
            ) : (
              <span>Henüz başka katılımcı yok · {capacity - memberCount} yer boş</span>
            )}
          </div>
          <code className="rounded-md border border-white/[0.08] bg-night-950/70 px-2 py-1 font-mono text-[10px] text-zinc-400">
            {shortRoomCode(roomId)}
          </code>
        </div>

        <div>
          <label htmlFor="invite-url" className="mb-1.5 block text-xs font-medium text-zinc-400">
            Davet bağlantısı
          </label>
          <Input
            id="invite-url"
            value={roomUrl}
            readOnly
            leadingIcon={<Link2 className="h-4 w-4" />}
            onFocus={(event) => event.currentTarget.select()}
            aria-label="Davet bağlantısı"
            className="font-mono text-[11.5px]"
          />
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-2.5 text-[11px] leading-relaxed text-emerald-200/70">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Oda kimliği 22 karakterlik rastgele bir koddur; tahmin edilemez. Bağlantıya sahip olan
            Davet bağlantısını açan kişi ikinci üye olarak katılır. Oda dolduğunda üçüncü kişiler reddedilir.
          </p>
        </div>
      </div>
    </Modal>
  )
}
