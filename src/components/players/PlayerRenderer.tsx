import type { PlayerHandle, PlayableSource, PlayerEvents } from '@/components/players/types'
import { Html5Player } from '@/components/players/Html5Player'
import { IframePlayer } from '@/components/players/IframePlayer'
import { VimeoPlayer } from '@/components/players/VimeoPlayer'
import { YouTubePlayer } from '@/components/players/YouTubePlayer'
import type { Ref } from 'react'

interface PlayerRendererProps {
  source: PlayableSource
  playerRef: Ref<PlayerHandle>
  events: PlayerEvents
}

export function PlayerRenderer({ source, playerRef, events }: PlayerRendererProps) {
  switch (source.provider) {
    case 'youtube':
      return <YouTubePlayer key={source.embedUrl} ref={playerRef} source={source} events={events} />
    case 'vimeo':
      return <VimeoPlayer key={source.embedUrl} ref={playerRef} source={source} events={events} />
    case 'iframe':
      return <IframePlayer key={source.embedUrl} ref={playerRef} source={source} events={events} />
    case 'hls':
    case 'html5':
      return <Html5Player key={source.url} ref={playerRef} source={source} events={events} />
    default:
      return null
  }
}
