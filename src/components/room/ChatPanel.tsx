import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { AppUser, ChatMessage } from '@/types'
import {
  AlertTriangle,
  ArrowDown,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Smile,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { useToast } from '@/context/ToastContext'
import { formatMessageTime } from '@/lib/format'
import { mapApiError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { sendChatMessage } from '@/services/rooms'

const EMOJIS = [
  '😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😮', '😴', '🙈',
  '👍', '👏', '🤝', '❤️', '💜', '🔥', '✨', '🎬', '🍿', '🎉',
]

const MAX_LENGTH = 2000

interface ChatPanelProps {
  roomId: string
  user: AppUser
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  onRetry: () => void
  partnerName: string | null
  partnerOnline: boolean
  className?: string
}

function dayKey(timestamp: number | null): string {
  if (!timestamp) return 'pending'
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function dayLabel(timestamp: number | null): string {
  if (!timestamp) return 'Şimdi'
  const date = new Date(timestamp)
  const today = new Date()
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const startThat = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const diff = Math.round((startToday - startThat) / 86_400_000)
  if (diff === 0) return 'Bugün'
  if (diff === 1) return 'Dün'
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
}

export function ChatPanel({
  roomId,
  user,
  messages,
  loading,
  error,
  onRetry,
  partnerName,
  partnerOnline,
  className,
}: ChatPanelProps) {
  const { pushToast } = useToast()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showEmojis, setShowEmojis] = useState(false)
  const [nearBottom, setNearBottom] = useState(true)
  const [hasNewBelow, setHasNewBelow] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previousCountRef = useRef(0)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }, [text])

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const container = scrollRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior })
    setHasNewBelow(false)
  }

  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    const isOwn = lastMessage?.senderId === user.uid

    if (nearBottom || isOwn) {
      scrollToBottom(previousCountRef.current === 0 ? 'auto' : 'smooth')
    } else if (messages.length > previousCountRef.current) {
      setHasNewBelow(true)
    }

    previousCountRef.current = messages.length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, nearBottom, user.uid])

  const handleScroll = () => {
    const container = scrollRef.current
    if (!container) return
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight
    const isNear = distance < 110
    setNearBottom(isNear)
    if (isNear) setHasNewBelow(false)
  }

  const submit = async () => {
    const value = text.trim()
    if (!value || sending) return

    setSending(true)
    try {
      await sendChatMessage(roomId, user, value)
      setText('')
      setShowEmojis(false)
      requestAnimationFrame(() => {
        textareaRef.current?.focus()
        scrollToBottom()
      })
    } catch (sendError) {
      const description =
        sendError instanceof Error && !('code' in sendError)
          ? sendError.message
          : mapApiError(sendError)
      pushToast({ kind: 'error', title: 'Mesaj gönderilemedi', description })
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void submit()
    }
  }

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? text.length
    const end = textarea?.selectionEnd ?? text.length
    const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`.slice(0, MAX_LENGTH)
    setText(next)

    requestAnimationFrame(() => {
      const element = textareaRef.current
      if (!element) return
      element.focus()
      const position = start + emoji.length
      element.setSelectionRange(position, position)
    })
  }

  const remaining = MAX_LENGTH - text.length

  return (
    <section className={cn('panel flex min-h-0 flex-col overflow-hidden', className)}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.04] text-brand-300">
            <MessageCircle className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-zinc-100">Sohbet</h2>
            <p className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              {partnerName ? (
                <>
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      partnerOnline ? 'bg-emerald-400' : 'bg-zinc-600',
                    )}
                  />
                  <span className="truncate">
                    {partnerName} {partnerOnline ? 'çevrimiçi' : 'çevrimdışı'}
                  </span>
                </>
              ) : (
                'Partner bekleniyor'
              )}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-500">
          Kalıcı
        </span>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto overscroll-contain px-3 py-3"
        >
          {loading ? (
            <div className="flex h-full flex-col justify-end gap-3">
              {[70, 50, 80].map((width, index) => (
                <div
                  key={index}
                  className={cn('flex gap-2', index % 2 === 0 ? 'justify-start' : 'justify-end')}
                >
                  <div
                    className="h-14 animate-pulse rounded-2xl bg-white/[0.05]"
                    style={{ width: `${width}%` }}
                  />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <AlertTriangle className="h-6 w-6 text-rose-300" />
              <p className="text-xs leading-relaxed text-zinc-400">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] text-zinc-300 transition hover:bg-white/[0.08]"
              >
                <RefreshCw className="h-3 w-3" />
                Tekrar dene
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-zinc-500">
                <MessageCircle className="h-5 w-5" />
              </span>
              <p className="mt-3 text-[13px] font-medium text-zinc-300">Sohbet henüz sessiz</p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
                İlk mesajı sen yaz. Mesajlar odada kalıcı olarak saklanır; sayfa yenilense de
                kaybolmaz.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {messages.map((message, index) => {
                const previous = messages[index - 1]
                const isOwn = message.senderId === user.uid
                const sameSender =
                  previous?.senderId === message.senderId &&
                  (previous?.createdAt && message.createdAt
                    ? message.createdAt - previous.createdAt < 3 * 60_000
                    : true)
                const showMeta = !sameSender
                const showDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt)

                return (
                  <div key={message.id}>
                    {showDay ? (
                      <div className="my-3 flex items-center gap-2.5">
                        <span className="h-px flex-1 bg-white/[0.05]" />
                        <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">
                          {dayLabel(message.createdAt)}
                        </span>
                        <span className="h-px flex-1 bg-white/[0.05]" />
                      </div>
                    ) : null}

                    <div
                      className={cn(
                        'flex items-end gap-1.5',
                        isOwn ? 'justify-end' : 'justify-start',
                        !showMeta && (isOwn ? 'pr-8' : 'pl-8'),
                      )}
                    >
                      {!isOwn ? (
                        <div className="w-7 shrink-0">
                          {showMeta ? (
                            <Avatar src={message.photoURL} name={message.senderName} size="xs" />
                          ) : null}
                        </div>
                      ) : null}

                      <div className={cn('min-w-0 max-w-[82%]', isOwn ? 'items-end' : 'items-start')}>
                        {showMeta ? (
                          <div
                            className={cn(
                              'mb-1 flex items-center gap-1.5 px-1 text-[9.5px]',
                              isOwn ? 'justify-end' : 'justify-start',
                            )}
                          >
                            <span className="max-w-[130px] truncate font-medium text-zinc-400">
                              {isOwn ? 'Sen' : message.senderName}
                            </span>
                            <span className="text-zinc-600">{formatMessageTime(message.createdAt)}</span>
                          </div>
                        ) : null}

                        <div
                          className={cn(
                            'whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed',
                            isOwn
                              ? 'rounded-br-md bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-[0_6px_20px_-12px_rgba(139,92,246,.8)]'
                              : 'rounded-bl-md border border-white/[0.06] bg-white/[0.055] text-zinc-200',
                          )}
                        >
                          {message.text}
                        </div>

                        {!showMeta ? (
                          <p
                            className={cn(
                              'mt-0.5 px-1 text-[8.5px] text-zinc-600',
                              isOwn ? 'text-right' : 'text-left',
                            )}
                          >
                            {formatMessageTime(message.createdAt)}
                          </p>
                        ) : null}
                      </div>

                      {isOwn ? (
                        <div className="w-7 shrink-0">
                          {showMeta ? (
                            <Avatar src={message.photoURL} name={message.senderName} size="xs" />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {hasNewBelow ? (
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-brand-400/25 bg-night-800/95 px-3 py-1.5 text-[10px] font-medium text-brand-200 shadow-panel backdrop-blur transition hover:bg-night-700"
          >
            <ArrowDown className="h-3 w-3" />
            Yeni mesajlar
          </button>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-white/[0.06] p-2.5 pb-safe">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className="overflow-hidden rounded-xl border border-white/10 bg-night-900/85 transition focus-within:border-brand-500/40 focus-within:ring-4 focus-within:ring-brand-500/[0.07]">
            {showEmojis ? (
              <div className="grid grid-cols-10 gap-0.5 border-b border-white/[0.06] p-2">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="grid h-7 place-items-center rounded-md text-base transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400"
                    aria-label={`${emoji} ekle`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, MAX_LENGTH))}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={MAX_LENGTH}
              placeholder="Bir mesaj yaz…"
              aria-label="Sohbet mesajı"
              className="block max-h-[120px] w-full resize-none bg-transparent px-3 pt-2.5 text-[12.5px] leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
            />

            <div className="flex items-center justify-between gap-2 px-2 pb-2">
              <button
                type="button"
                onClick={() => setShowEmojis((value) => !value)}
                aria-label="Emoji seç"
                aria-expanded={showEmojis}
                className={cn(
                  'grid h-7 w-7 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                  showEmojis && 'bg-white/[0.06] text-brand-300',
                )}
              >
                <Smile className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2">
                {remaining < 200 ? (
                  <span
                    className={cn(
                      'font-mono text-[9px]',
                      remaining < 0 ? 'text-rose-400' : remaining < 60 ? 'text-amber-400' : 'text-zinc-600',
                    )}
                  >
                    {text.length}/{MAX_LENGTH}
                  </span>
                ) : null}
                <span className="hidden text-[9px] text-zinc-600 sm:inline">
                  Enter gönder · Shift+Enter satır
                </span>
                <button
                  type="submit"
                  disabled={!text.trim() || sending}
                  aria-label="Mesajı gönder"
                  className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </section>
  )
}
