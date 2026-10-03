import { io } from 'socket.io-client'

let socket = null
let currentUserKey = null

function userKey(user) {
  return user ? `${user.id}:${user.role}` : null
}

export function getRealtimeSocket(user) {
  const url = import.meta.env.VITE_REALTIME_URL
  const secret = import.meta.env.VITE_REALTIME_SECRET
  if (!user || !url || !secret) return null

  const key = userKey(user)
  if (socket && currentUserKey === key) return socket

  disconnectRealtimeSocket()

  socket = io(url, {
    auth: {
      token: secret,
      userId: user.id,
      role: user.role,
      name: user.name,
    },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1000,
    timeout: 10000,
    autoConnect: true,
  })

  currentUserKey = key
  return socket
}

export function disconnectRealtimeSocket() {
  if (!socket) return
  socket.removeAllListeners()
  socket.disconnect()
  socket = null
  currentUserKey = null
}
