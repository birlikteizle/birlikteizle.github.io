import { useCallback, useEffect, useState } from 'react'
import { clearRecentRooms, readRecentRooms, subscribeToRecentRooms, type RecentRoom } from '@/lib/recentRooms'

export function useRecentRooms(): { rooms: RecentRoom[]; clear: () => void } {
  const [rooms, setRooms] = useState<RecentRoom[]>(() => readRecentRooms())

  useEffect(() => {
    const sync = () => setRooms(readRecentRooms())
    sync()
    return subscribeToRecentRooms(sync)
  }, [])

  const clear = useCallback(() => {
    clearRecentRooms()
    setRooms([])
  }, [])

  return { rooms, clear }
}
