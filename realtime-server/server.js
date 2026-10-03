import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'

dotenv.config()

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:5173', methods: ['GET', 'POST'] },
})

const PORT = process.env.PORT || 3001
const SHARED_SECRET = process.env.REALTIME_SECRET || 'reservance-dev-secret'

app.use(cors())
app.use(express.json())

const presence = new Map()
const attemptMonitors = new Map()

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'reservance-realtime' })
})

app.post('/broadcast', (req, res) => {
  const secret = req.headers['x-realtime-secret']
  if (!secret || secret !== SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { event = 'system:refresh', room = null, payload = {} } = req.body || {}

  if (room) {
    io.to(room).emit(event, payload)
  } else {
    io.emit(event, payload)
  }

  return res.json({ ok: true })
})

io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token || token !== SHARED_SECRET) {
    return next(new Error('Unauthorized'))
  }
  next()
})

io.on('connection', (socket) => {
  const { userId, role, name } = socket.handshake.auth
  if (userId) {
    presence.set(String(userId), { userId, role, name, status: 'online', socketId: socket.id, lastActivity: Date.now() })
    socket.join(`role:${role}`)
    socket.join(`user:${userId}`)
    io.emit('presence:update', Array.from(presence.values()))
  }

  socket.on('presence:heartbeat', (payload) => {
    const id = String(payload?.userId || userId)
    const existing = presence.get(id) || { userId: id, role, name }
    presence.set(id, { ...existing, status: payload?.status || 'online', lastActivity: Date.now(), socketId: socket.id })
    io.emit('presence:update', Array.from(presence.values()))
  })

  socket.on('attempt:progress', (payload) => {
    if (!payload?.attemptId) return
    attemptMonitors.set(String(payload.attemptId), { ...payload, updatedAt: Date.now() })
    io.to('faculty-monitor').emit('attempt:update', payload)
  })

  socket.on('faculty:join-monitor', () => {
    if (role === 'faculty' || role === 'super_admin') {
      socket.join('faculty-monitor')
      socket.emit('attempt:snapshot', Array.from(attemptMonitors.values()))
    }
  })

  socket.on('disconnect', () => {
    if (userId) {
      const entry = presence.get(String(userId))
      if (entry?.socketId === socket.id) {
        presence.set(String(userId), { ...entry, status: 'offline', lastActivity: Date.now() })
        io.emit('presence:update', Array.from(presence.values()))
      }
    }
  })
})

httpServer.listen(PORT, () => {
  console.log(`RESERVANCE realtime server on :${PORT}`)
})
