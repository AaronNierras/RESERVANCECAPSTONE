import { io } from 'socket.io-client'
import { getRuntimeConfig } from '../config'

let socket = null
let currentUserKey = null

function userKey(user) {
  return user ? `${user.id}:${user.role}` : null
}

export function getRealtimeSocket(user) {
  const { realtimeUrl: url, realtimeSecret: secret } = getRuntimeConfig()
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
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 12,
    reconnectionDelay: 1000,
    timeout: 15000,
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
