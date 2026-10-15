/**
 * One-window supervisor for the RESERVANCE classroom stack.
 * Started by start-reservance.bat. Child servers stay hidden;
 * this console shows status, logs, restart keys, and stop.
 */
import { spawn, execFileSync } from 'child_process'
import net from 'net'
import path from 'path'
import readline from 'readline'

const root = process.env.RESERVANCE_ROOT || process.cwd()
const php = process.env.RESERVANCE_PHP || ''
const npm = process.env.RESERVANCE_NPM || ''
const lanIp = process.env.RESERVANCE_LAN_IP || '127.0.0.1'
const programChairUrl = `http://${lanIp}:5173/program-chair/dashboard`
const interactive = Boolean(process.stdout.isTTY && process.stdin.isTTY)

if (!php || !npm) {
  console.error('Start RESERVANCE with start-reservance.bat so PHP and npm are found.')
  process.exit(1)
}

const backend = path.join(root, 'backend')
const frontend = path.join(root, 'frontend')
const realtime = path.join(root, 'realtime-server')
const comspec = process.env.ComSpec || 'cmd.exe'

function launch(command, args, options) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  child.stdin?.on('error', () => {})
  child.stdout?.on('error', () => {})
  child.stderr?.on('error', () => {})
  return child
}

const services = [
  {
    key: '1',
    id: 'api1',
    name: 'API 1',
    port: 8001,
    status: 'STARTING',
    generation: 0,
    child: null,
    spawn: () =>
      launch(php, ['artisan', 'serve', '--host=127.0.0.1', '--port=8001'], { cwd: backend }),
  },
  {
    key: '2',
    id: 'api2',
    name: 'API 2',
    port: 8002,
    status: 'STARTING',
    generation: 0,
    child: null,
    spawn: () =>
      launch(php, ['artisan', 'serve', '--host=127.0.0.1', '--port=8002'], { cwd: backend }),
  },
  {
    key: '3',
    id: 'api3',
    name: 'API 3',
    port: 8003,
    status: 'STARTING',
    generation: 0,
    child: null,
    spawn: () =>
      launch(php, ['artisan', 'serve', '--host=127.0.0.1', '--port=8003'], { cwd: backend }),
  },
  {
    key: '4',
    id: 'api4',
    name: 'API 4',
    port: 8004,
    status: 'STARTING',
    generation: 0,
    child: null,
    spawn: () =>
      launch(php, ['artisan', 'serve', '--host=127.0.0.1', '--port=8004'], { cwd: backend }),
  },
  {
    key: '5',
    id: 'gateway',
    name: 'API Gateway',
    port: 8000,
    status: 'STARTING',
    generation: 0,
    child: null,
    spawn: () =>
      launch(process.execPath, [path.join(root, 'tools', 'api-gateway.mjs')], {
        cwd: root,
        env: { ...process.env, API_GATEWAY_HOST: '0.0.0.0' },
      }),
  },
  {
    key: '6',
    id: 'frontend',
    name: 'Frontend',
    port: 5173,
    status: 'STARTING',
    generation: 0,
    child: null,
    spawn: () =>
      launch(process.execPath, [path.join(frontend, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '0.0.0.0', '--port', '5173', '--strictPort'], {
        cwd: frontend,
        env: process.env,
      }),
  },
  {
    key: '7',
    id: 'realtime',
    name: 'Realtime',
    port: 3001,
    status: 'STARTING',
    generation: 0,
    child: null,
    spawn: () =>
      launch(process.execPath, [path.join(realtime, 'server.js')], {
        cwd: realtime,
        env: { ...process.env, HOST: '0.0.0.0', CORS_ORIGIN: '*' },
      }),
  },
]

let mysqlStatus = 'CHECKING'
let stopping = false
let confirmStop = false
let confirmTimer = null
let openedBrowser = false
let dashboard = interactive
let renderTimer = null
let polling = false
let pollTimer = null
let portHintShown = false
const logBuffer = []

function stripAnsi(text) {
  return String(text)
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b./g, '')
}

function pushLog(tag, text) {
  const clean = stripAnsi(text).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trimEnd()
  if (!clean.trim()) return
  const line = `[${tag}] ${clean}`
  const showPortHint = !portHintShown && /already in use|EADDRINUSE/i.test(clean)
  if (showPortHint) portHintShown = true
  if (!dashboard) {
    console.log(line)
  } else {
    logBuffer.push(line)
    if (logBuffer.length > 400) logBuffer.splice(0, logBuffer.length - 400)
    renderSoon()
  }
  if (showPortHint) {
    pushLog(
      'RESERVANCE',
      'A port is already in use. Close the old RESERVANCE command windows, then press that server number to start it here.',
    )
  }
}

function fit(text, cols) {
  if (text.length <= cols) return text
  return text.slice(0, Math.max(0, cols - 1))
}

function statusColor(status) {
  if (status === 'RUNNING') return '\x1b[32m'
  if (status === 'STOPPED') return '\x1b[31m'
  return '\x1b[33m'
}

function paintStatus(line, status) {
  const color = statusColor(status)
  return line.replace(status, `${color}${status}\x1b[0m`)
}

function row(name, status, port, action) {
  return `  ${name.padEnd(14)} ${status.padEnd(11)} ${String(port).padEnd(6)} ${action}`
}

function footerBar(text, cols) {
  const content = fit(` ${text}`, cols)
  const padded = content + ' '.repeat(Math.max(0, cols - content.length))
  const color = confirmStop ? '\x1b[41m\x1b[97m' : '\x1b[7m'
  return `${color}${padded}\x1b[0m`
}

function colorLog(line) {
  const match = line.match(/^(\[[^\]]+\])(.*)$/)
  if (!match) return line
  return `\x1b[36m${match[1]}\x1b[0m${match[2]}`
}

function render() {
  if (!dashboard) return
  const cols = Math.max(40, process.stdout.columns || 100)
  const rows = Math.max(16, process.stdout.rows || 30)

  const core = [
    `\x1b[1m${fit(' RESERVANCE', cols)}\x1b[0m`,
    fit(' All servers run in this window.', cols),
    '',
    fit(row('Server', 'Status', 'Port', 'Action'), cols),
    `\x1b[2m${fit('  ------------------------------------------------', cols)}\x1b[0m`,
    paintStatus(fit(row('MySQL', mysqlStatus, 3306, 'stays on'), cols), mysqlStatus),
  ]
  for (const svc of services) {
    core.push(paintStatus(fit(row(svc.name, svc.status, svc.port, `press ${svc.key}`), cols), svc.status))
  }

  const extra = [
    '',
    fit(`  Program Chair: ${programChairUrl}`, cols),
    fit(`  Students:   http://${lanIp}:5173`, cols),
    '',
    `\x1b[2m${fit('  Output', cols)}\x1b[0m`,
  ]

  let header = core.concat(extra)
  let logRoom = rows - header.length - 1
  if (logRoom < 4) {
    header = core.concat([''])
    logRoom = rows - header.length - 1
  }
  if (logRoom < 1) logRoom = 1

  const visible = logBuffer.slice(-logRoom)
  const logs = []
  for (let i = 0; i < logRoom - visible.length; i += 1) logs.push('')
  for (const line of visible) logs.push(colorLog(fit(line, cols)))

  let footerText = '1-7 restart that server      A restart all      S stop all servers'
  if (confirmStop) footerText = 'Press S again to stop all servers. Any other key cancels.'
  if (stopping) footerText = 'Stopping all servers. MySQL stays on.'

  const body = [...header, ...logs, footerBar(footerText, cols)]
  process.stdout.write(`\x1b[?25l\x1b[H\x1b[J${body.join('\r\n')}`)
}

function renderSoon() {
  if (!dashboard || renderTimer) return
  renderTimer = setTimeout(() => {
    renderTimer = null
    render()
  }, 80)
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    let done = false
    const finish = (up) => {
      if (done) return
      done = true
      socket.destroy()
      resolve(up)
    }
    socket.setTimeout(400)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

function openAppOnce() {
  if (openedBrowser) return
  openedBrowser = true
  pushLog('RESERVANCE', `Opening Program Chair site ${programChairUrl}`)
  spawn(comspec, ['/d', '/s', '/c', `start "" "${programChairUrl}"`], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref()
}

async function maybeOpenSuperadmin() {
  if (openedBrowser || stopping) return
  const [siteUp, apiUp] = await Promise.all([portOpen(5173), portOpen(8000)])
  if (siteUp && apiUp) openAppOnce()
}

async function refreshPorts() {
  if (polling || stopping) return
  polling = true
  try {
    mysqlStatus = (await portOpen(3306)) ? 'RUNNING' : 'STOPPED'
    for (const svc of services) {
      if (!svc.child || svc.status === 'RESTARTING') continue
      const up = await portOpen(svc.port)
      if (!svc.child || svc.status === 'RESTARTING' || stopping) continue
      const next = up ? 'RUNNING' : 'STARTING'
      if (svc.status !== next) svc.status = next
    }
    await maybeOpenSuperadmin()
  } finally {
    polling = false
    if (!stopping) renderSoon()
  }
}

function attachLogs(svc, child) {
  const bind = (stream) => {
    if (!stream) return
    let buf = ''
    stream.on('data', (chunk) => {
      buf += chunk.toString()
      const parts = buf.split(/\r?\n/)
      buf = parts.pop() ?? ''
      for (const part of parts) pushLog(svc.name, part)
    })
  }
  bind(child.stdout)
  bind(child.stderr)
}

async function waitForPortFree(port) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (!(await portOpen(port))) return true
    await sleep(300)
  }
  return false
}

async function startService(svc, options = {}) {
  const gen = svc.generation
  svc.status = 'STARTING'
  renderSoon()
  const free = options.waitForFree ? await waitForPortFree(svc.port) : !(await portOpen(svc.port))
  if (stopping || svc.generation !== gen) return
  if (!free) {
    svc.child = null
    svc.status = 'STOPPED'
    pushLog(svc.name, `Port ${svc.port} is already in use.`)
    return
  }
  let child
  try {
    child = svc.spawn()
  } catch (err) {
    svc.child = null
    svc.status = 'STOPPED'
    pushLog(svc.name, err.message)
    return
  }
  svc.child = child
  attachLogs(svc, child)
  child.on('error', (err) => {
    if (svc.generation !== gen) return
    svc.child = null
    svc.status = 'STOPPED'
    pushLog(svc.name, err.message)
    renderSoon()
  })
  child.on('exit', (code, signal) => {
    if (svc.generation !== gen) return
    svc.child = null
    if (stopping) return
    svc.status = 'STOPPED'
    pushLog(svc.name, `Stopped (exit ${code ?? signal ?? '?'})`)
    renderSoon()
  })
  renderSoon()
}

function killTree(pid) {
  return new Promise((resolve) => {
    const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    })
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }
    killer.on('exit', finish)
    killer.on('error', finish)
    setTimeout(finish, 4000)
  })
}

function killAllSync() {
  for (const svc of services) {
    const pid = svc.child?.pid
    if (!pid) continue
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
    } catch {
      // already gone
    }
    svc.child = null
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function restart(svc) {
  if (stopping || svc.status === 'RESTARTING') return
  const gen = ++svc.generation
  svc.status = 'RESTARTING'
  pushLog(svc.name, 'Restarting...')
  const pid = svc.child?.pid
  svc.child = null
  if (pid) {
    await killTree(pid)
    await sleep(400)
  }
  if (stopping || svc.generation !== gen) return
  await startService(svc, { waitForFree: true })
}

function cleanupTerminal() {
  dashboard = false
  if (!interactive) return
  try {
    process.stdin.setRawMode(false)
  } catch {
    // already cooked
  }
  process.stdout.write('\x1b[?25h\x1b[?1049l\r\n')
}

function shutdown() {
  if (stopping) return
  stopping = true
  confirmStop = false
  clearTimeout(confirmTimer)
  if (pollTimer) clearInterval(pollTimer)
  killAllSync()
  for (const svc of services) {
    svc.generation += 1
    svc.status = 'STOPPED'
  }
  cleanupTerminal()
  console.log('All RESERVANCE servers are stopped.')
  console.log('MySQL is still running.')
  process.exit(0)
}

function onKey(str, key) {
  if (stopping) return
  if (key?.ctrl && key?.name === 'c') {
    shutdown()
    return
  }
  const ch = (str && str.length === 1 ? str : key?.name || '').toLowerCase()
  if (!ch || ch.length !== 1) return
  if (confirmStop) {
    if (ch === 's') shutdown()
    else {
      confirmStop = false
      clearTimeout(confirmTimer)
      renderSoon()
    }
    return
  }
  if (ch === 's') {
    confirmStop = true
    clearTimeout(confirmTimer)
    confirmTimer = setTimeout(() => {
      confirmStop = false
      renderSoon()
    }, 8000)
    renderSoon()
    return
  }
  if (ch === 'a') {
    for (const svc of services) restart(svc)
    return
  }
  const svc = services.find((item) => item.key === ch)
  if (svc) restart(svc)
}

process.on('exit', () => {
  killAllSync()
})
process.on('SIGINT', () => {
  shutdown()
})
process.on('SIGHUP', () => {
  shutdown()
})
process.on('SIGBREAK', () => {
  shutdown()
})
process.on('uncaughtException', (err) => {
  killAllSync()
  cleanupTerminal()
  console.error(err?.stack || err)
  process.exit(1)
})

if (interactive) {
  readline.emitKeypressEvents(process.stdin)
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.on('keypress', onKey)
  process.stdin.on('close', () => shutdown())
  process.stdout.write('\x1b[?1049h\x1b[?25l')
  process.stdout.on('resize', () => render())
}

pushLog('RESERVANCE', 'Starting API workers, gateway, website, and realtime.')
await Promise.all(
  services.map(async (svc) => {
    svc.generation = 1
    await startService(svc)
  }),
)

pollTimer = setInterval(() => {
  refreshPorts()
}, 1000)
setTimeout(() => {
  refreshPorts()
}, 400)
render()
