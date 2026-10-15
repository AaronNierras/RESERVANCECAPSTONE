/**
 * Zero-dependency round-robin API gateway.
 * Fans traffic across several php artisan serve workers so a school lab
 * of 100+ browsers is not stuck on one single-threaded PHP process.
 */
import http from 'http'

const LISTEN_HOST = process.env.API_GATEWAY_HOST || '0.0.0.0'
const LISTEN_PORT = Number(process.env.API_GATEWAY_PORT || 8000)
const WORKERS = String(process.env.API_WORKERS || '8001,8002,8003,8004')
  .split(',')
  .map((v) => Number(v.trim()))
  .filter((n) => Number.isFinite(n) && n > 0)

let cursor = 0
const stats = { requests: 0, errors: 0 }

function nextWorker() {
  const port = WORKERS[cursor % WORKERS.length]
  cursor += 1
  return port
}

const server = http.createServer((req, res) => {
  stats.requests += 1
  const port = nextWorker()
  const headers = { ...req.headers, host: `127.0.0.1:${port}` }

  const proxy = http.request(
    {
      hostname: '127.0.0.1',
      port,
      path: req.url,
      method: req.method,
      headers,
      timeout: 120000,
    },
    (upstream) => {
      res.writeHead(upstream.statusCode || 502, upstream.headers)
      upstream.pipe(res)
    },
  )

  proxy.on('timeout', () => {
    stats.errors += 1
    proxy.destroy()
    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: 'API worker timed out. Try again.' }))
    }
  })

  proxy.on('error', () => {
    stats.errors += 1
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: 'API worker unavailable. Wait a moment and refresh.' }))
    } else {
      res.end()
    }
  })

  req.pipe(proxy)
})

server.requestTimeout = 120000
server.headersTimeout = 125000
server.keepAliveTimeout = 65000
server.maxHeadersCount = 100

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${LISTEN_PORT} is already in use.`)
  } else {
    console.error(err.message)
  }
  process.exit(1)
})

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`RESERVANCE API gateway on http://${LISTEN_HOST}:${LISTEN_PORT}`)
  console.log(`Workers: ${WORKERS.map((p) => `127.0.0.1:${p}`).join(', ')}`)
  console.log('Classroom capacity mode: round-robin across PHP workers')
})

setInterval(() => {
  if (stats.requests === 0) return
  console.log(`gateway stats requests=${stats.requests} errors=${stats.errors}`)
}, 60000)
