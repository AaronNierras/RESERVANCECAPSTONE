import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'

dotenv.config()

const app = express()
const httpServer = createServer(app)
const corsOrigin = process.env.CORS_ORIGIN || true
const io = new Server(httpServer, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  // Classroom labs: many concurrent sockets
  maxHttpBufferSize: 1e6,
  pingInterval: 25000,
  pingTimeout: 20000,
  perMessageDeflate: false,
  connectTimeout: 20000,
})

const PORT = Number(process.env.PORT || 3001)
const HOST = process.env.HOST || '0.0.0.0'
const SHARED_SECRET = process.env.REALTIME_SECRET || 'reservance-dev-secret'

app.use(cors({ origin: corsOrigin }))
app.use(express.json({ limit: '256kb' }))

const presence = new Map()
const attemptMonitors = new Map()
let presenceDirty = false
let lastPresenceBroadcast = 0

function presenceList() {
  return Array.from(presence.values())
}

function broadcastPresence(force = false) {
  const now = Date.now()
  if (!force && now - lastPresenceBroadcast < 1500) {
    presenceDirty = true
    return
  }
  lastPresenceBroadcast = now
  presenceDirty = false
  io.emit('presence:update', presenceList())
}

setInterval(() => {
  if (presenceDirty) broadcastPresence(true)
}, 1500)

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'reservance-realtime',
    connections: io.engine?.clientsCount || 0,
    presence: presence.size,
  })
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
    presence.set(String(userId), {
      userId,
      role,
      name,
      status: 'online',
      socketId: socket.id,
      lastActivity: Date.now(),
    })
    socket.join(`role:${role}`)
    socket.join(`user:${userId}`)
    broadcastPresence()
  }

  socket.on('presence:heartbeat', (payload) => {
    const id = String(payload?.userId || userId)
    if (!id || id === 'undefined') return
    const existing = presence.get(id) || { userId: id, role, name }
    presence.set(id, {
      ...existing,
      status: payload?.status || 'online',
      lastActivity: Date.now(),
      socketId: socket.id,
    })
    broadcastPresence()
  })

  socket.on('attempt:progress', (payload) => {
    if (!payload?.attemptId) return
    attemptMonitors.set(String(payload.attemptId), { ...payload, updatedAt: Date.now() })
    io.to('faculty-monitor').emit('attempt:update', payload)
  })

  socket.on('faculty:join-monitor', () => {
    if (role === 'faculty' || role === 'program_chair') {
      socket.join('faculty-monitor')
      socket.emit('attempt:snapshot', Array.from(attemptMonitors.values()))
    }
  })

  socket.on('disconnect', () => {
    if (userId) {
      const entry = presence.get(String(userId))
      if (entry?.socketId === socket.id) {
        presence.set(String(userId), { ...entry, status: 'offline', lastActivity: Date.now() })
        broadcastPresence()
      }
    }
  })
})

httpServer.listen(PORT, HOST, () => {
  console.log(`RESERVANCE realtime server on http://${HOST}:${PORT}`)
  console.log('Classroom mode: presence broadcasts are throttled for 100+ users')
})
