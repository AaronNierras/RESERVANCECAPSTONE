import { createContext, useContext, useEffect, useState } from 'react'
import { disconnectRealtimeSocket, getRealtimeSocket } from '../lib/realtimeSocket'
import { useAuth } from './AuthContext'

const RealtimeContext = createContext({ refreshTick: 0 })

export function RealtimeProvider({ children }) {
  const { user } = useAuth()
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    if (!user) {
      disconnectRealtimeSocket()
      return undefined
    }

    const socket = getRealtimeSocket(user)
    if (!socket) return undefined

    const bump = (payload = {}) => {
      setRefreshTick((tick) => tick + 1)
      window.dispatchEvent(new CustomEvent('reservance:refresh', { detail: payload }))
    }
    const bumpNotifications = () => bump({ resource: 'notifications' })
    const bumpMonitor = () => bump({ resource: 'monitor' })

    socket.on('system:refresh', bump)
    socket.on('notifications:update', bumpNotifications)
    socket.on('attempt:update', bumpMonitor)

    if (user.role === 'faculty' || user.role === 'program_chair') {
      socket.emit('faculty:join-monitor')
    }

    return () => {
      socket.off('system:refresh', bump)
      socket.off('notifications:update', bumpNotifications)
      socket.off('attempt:update', bumpMonitor)
    }
  }, [user])

  return (
    <RealtimeContext.Provider value={{ refreshTick }}>
      {children}
    </RealtimeContext.Provider>
  )
}

export function useRefreshTick() {
  return useContext(RealtimeContext).refreshTick
}

export function useOnSystemRefresh(callback) {
  const refreshTick = useRefreshTick()

  useEffect(() => {
    callback()
  }, [refreshTick, callback])
}
