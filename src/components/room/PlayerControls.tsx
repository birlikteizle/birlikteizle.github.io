import type { ReactNode } from 'react'
import {
  Captions,
  ChevronDown,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { RangeSlider } from '@/components/ui/RangeSlider'
import { formatClock } from '@/lib/format'
import { cn } from '@/lib/utils'

export type SyncStatus = 'synced' | 'adjusting' | 'offline' | 'loading'

interface PlayerControlsProps {
  playing: boolean
  currentTime: number
  duration: number
  buffered: number
  playbackRate: number
  volume: number
  muted: boolean
  isFullscreen: boolean
  canControl: boolean
  syncStatus: SyncStatus
  subtitlesAvailable: boolean
  subtitlesEnabled: boolean
  onSubtitleClick: () => void
  onTogglePlay: () => void
  onSeekPreview: (time: number) => void
  onSeek: (time: number) => void
  onSkip: (seconds: number) => void
  onRateChange: (rate: number) => void
  onVolumeChange: (volume: number) => void
  onToggleMute: () => void
  onToggleFullscreen: () => void
}

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

const SYNC_META: Record<SyncStatus, { label: string; dot: string; text: string }> = {
  synced: { label: 'Senkron', dot: 'bg-emerald-400', text: 'text-emerald-300/90' },
  adjusting: { label: 'Hizalanıyor', dot: 'bg-amber-400 animate-pulse', text: 'text-amber-300/90' },
  offline: { label: 'Bağlantı yok', dot: 'bg-rose-400', text: 'text-rose-300/90' },
  loading: { label: 'Hazırlanıyor', dot: 'bg-zinc-400 animate-pulse', text: 'text-zinc-400' },
}

function ControlButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function PlayerControls({
  playing,
  currentTime,
  duration,
  buffered,
  playbackRate,
  volume,
  muted,
  isFullscreen,
  canControl,
  syncStatus,
  subtitlesAvailable,
  subtitlesEnabled,
  onSubtitleClick,
  onTogglePlay,
  onSeekPreview,
  onSeek,
  onSkip,
  onRateChange,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
}: PlayerControlsProps) {
  const sync = SYNC_META[syncStatus]
  const effectiveVolume = muted ? 0 : volume

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2.5 pb-2 pt-10 sm:px-4 sm:pb-3">
      <RangeSlider
        value={currentTime}
        max={duration}
        buffered={buffered}
        step={0.05}
        disabled={!canControl || duration <= 0}
        ariaLabel="Video zaman çizgisi"
        formatValue={formatClock}
        onChange={onSeekPreview}
        onCommit={onSeek}
        className="mb-0.5"
      />

      <div className="flex items-center gap-0.5 sm:gap-1">
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={!canControl}
          aria-label={playing ? 'Duraklat' : 'Oynat'}
          title={playing ? 'Duraklat (Boşluk)' : 'Oynat (Boşluk)'}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-night-950 shadow-lg transition hover:scale-105 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {playing ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          )}
        </button>

        <ControlButton
          label="10 saniye geri"
          onClick={() => onSkip(-10)}
          disabled={!canControl}
          className="hidden sm:grid"
        >
          <RotateCcw className="h-4 w-4" />
        </ControlButton>
        <ControlButton
          label="10 saniye ileri"
          onClick={() => onSkip(10)}
          disabled={!canControl}
          className="hidden sm:grid"
        >
          <RotateCw className="h-4 w-4" />
        </ControlButton>

        <span className="ml-0.5 shrink-0 font-mono text-[10px] tabular-nums text-zinc-300 sm:ml-1.5 sm:text-[11px]">
          {formatClock(currentTime)}
          <span className="text-zinc-500"> / {formatClock(duration)}</span>
        </span>

        <div className="flex-1" />

        <div className="relative hidden items-center md:flex" title={`Senkronizasyon: ${sync.label}`}>
          <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', sync.dot)} />
          <span className={cn('text-[10px] font-medium', sync.text)}>{sync.label}</span>
        </div>

        <ControlButton
          label={
            subtitlesAvailable
              ? subtitlesEnabled
                ? 'Altyazıyı kapat (yalnızca bu cihaz)'
                : 'Altyazıyı aç (yalnızca bu cihaz)'
              : 'Yerel altyazı dosyası yükle (.vtt / .srt)'
          }
          onClick={onSubtitleClick}
          className={cn('relative', subtitlesEnabled && 'text-brand-300')}
        >
          <Captions className="h-4 w-4" />
          {subtitlesAvailable ? (
            <span
              className={cn(
                'absolute right-1 top-1 h-1 w-1 rounded-full',
                subtitlesEnabled ? 'bg-brand-300' : 'bg-zinc-500',
              )}
            />
          ) : null}
        </ControlButton>

        <div className="relative">
          <select
            value={playbackRate}
            onChange={(event) => onRateChange(Number(event.target.value))}
            disabled={!canControl}
            aria-label="Oynatma hızı"
            title="Oynatma hızı (iki tarafta ortak)"
            className="h-7 w-[50px] cursor-pointer appearance-none rounded-md border border-white/10 bg-white/[0.07] text-center text-[10px] font-semibold text-zinc-200 transition hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-40 sm:w-[58px] sm:text-[11px]"
          >
            {RATES.map((rate) => (
              <option key={rate} value={rate} className="bg-night-900 text-zinc-100">
                {rate}×
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-1 top-1/2 hidden h-3 w-3 -translate-y-1/2 text-zinc-500 sm:block"
            aria-hidden
          />
        </div>

        <div className="hidden items-center gap-1.5 pl-0.5 sm:flex">
          <ControlButton label={muted ? 'Sesi aç' : 'Sesi kapat'} onClick={onToggleMute}>
            {muted || effectiveVolume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </ControlButton>
          <RangeSlider
            value={effectiveVolume}
            max={1}
            step={0.01}
            ariaLabel="Ses seviyesi (yalnızca bu cihaz)"
            formatValue={(value) => `${Math.round(value * 100)}%`}
            onChange={onVolumeChange}
            onCommit={onVolumeChange}
            className="hidden w-16 md:flex"
            trackClassName="h-1"
            accent="white"
          />
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}
          className="grid h-8 w-8 place-items-center rounded-lg text-zinc-300 transition hover:bg-white/10 sm:hidden"
        >
          {muted || effectiveVolume === 0 ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>

        <ControlButton
          label={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
          onClick={onToggleFullscreen}
          className="h-9 w-9"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </ControlButton>
      </div>
    </div>
  )
}
