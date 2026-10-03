import { useEffect } from 'react'
import { useRefreshTick } from '../context/RealtimeContext'

export function useAutoRefresh(effect, deps = []) {
  const refreshTick = useRefreshTick()

  useEffect(() => {
    effect()
  }, [refreshTick, ...deps])
}
