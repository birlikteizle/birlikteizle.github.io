/**
 * Uzak video akışı öldüğünde haber verir.
 *
 * Yayıncı ekran paylaşımını durdurduğunda ya da bağlantı koptuğunda alıcı
 * taraftaki video kanalı `muted` duruma geçer; tarayıcı uzak kanallar için
 * `ended` olayını her zaman tetiklemez. Bu yüzden kanalı izleyip belirli bir
 * süre boyunca ses/görüntü gelmezse akışı "ölü" sayıyoruz.
 */
export function watchRemoteStream(
  stream: MediaStream,
  onDead: () => void,
  delayMs = 3000,
): () => void {
  const timers = new Map<MediaStreamTrack, number>()

  const markDead = (track: MediaStreamTrack) => {
    if (timers.has(track)) return
    const timer = window.setTimeout(() => {
      timers.delete(track)
      if (track.muted || track.readyState === 'ended') onDead()
    }, delayMs)
    timers.set(track, timer)
  }

  const markAlive = (track: MediaStreamTrack) => {
    const timer = timers.get(track)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timers.delete(track)
    }
  }

  const tracks = stream.getTracks()
  const listeners: Array<() => void> = []

  for (const track of tracks) {
    const onMute = () => markDead(track)
    const onUnmute = () => markAlive(track)
    const onEnded = () => markDead(track)

    track.addEventListener('mute', onMute)
    track.addEventListener('unmute', onUnmute)
    track.addEventListener('ended', onEnded)
    listeners.push(() => {
      track.removeEventListener('mute', onMute)
      track.removeEventListener('unmute', onUnmute)
      track.removeEventListener('ended', onEnded)
    })

    // Akış hâlihazırda sessiz/bitmiş geldiyse hemen izlemeye başla.
    if (track.muted || track.readyState === 'ended') markDead(track)
  }

  return () => {
    for (const remove of listeners) remove()
    for (const timer of timers.values()) window.clearTimeout(timer)
    timers.clear()
  }
}