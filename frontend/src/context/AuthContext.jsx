import { createContext, useContext, useEffect, useRef, useState } from 'react'
import client, { clearAuth, getStoredUser, setAuth } from '../api/client'
import { getRuntimeConfig } from '../config'
import LoadingScreen from '../components/LoadingScreen'

const AuthContext = createContext(null)
const IDLE_MS = 10 * 60 * 1000
const HEARTBEAT_MS = 30000
const PRESENCE_ROLES = new Set(['student', 'faculty'])

function markOfflineOnUnload(token) {
  if (!token) return
  // Do not call /logout here — refresh would sign the user out.
  // Offline presence lets the next login clear leftover tokens server-side.
  fetch(`${getRuntimeConfig().apiUrl}/presence/heartbeat`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status: 'offline' }),
    keepalive: true,
  }).catch(() => {})
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser())
  const [loading, setLoading] = useState(() => {
    const token = localStorage.getItem('reservance_token')
    if (!token) return false
    return !getStoredUser()
  })
  const logoutRef = useRef(null)

  useEffect(() => {
    if (!localStorage.getItem('reservance_token')) {
      setLoading(false)
      return
    }
    client.get('/user')
      .then((res) => {
        setUser(res.data.user)
        localStorage.setItem('reservance_user', JSON.stringify(res.data.user))
      })
      .catch(() => {
        clearAuth()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user || !PRESENCE_ROLES.has(user.role)) return undefined

    const beat = () => client.post('/presence/heartbeat', { status: 'online' }).catch(() => {})
    beat()
    const id = setInterval(beat, HEARTBEAT_MS)
    return () => clearInterval(id)
  }, [user])

  useEffect(() => {
    if (!user) return undefined

    let timerId

    const handleIdleTimeout = async () => {
      try {
        await client.post('/logout')
      } catch {
        // Session may already be invalid.
      } finally {
        clearAuth()
        setUser(null)
        window.location.href = '/login?reason=idle'
      }
    }

    const resetIdleTimer = () => {
      window.clearTimeout(timerId)
      timerId = window.setTimeout(handleIdleTimeout, IDLE_MS)
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }))
    resetIdleTimer()

    return () => {
      window.clearTimeout(timerId)
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer))
    }
  }, [user])

  const login = async (email, password) => {
    const res = await client.post('/login', { email, password })
    setAuth(res.data.token, res.data.user)
    setUser(res.data.user)
    return res.data.user
  }

  const register = async (payload) => {
    const res = await client.post('/register', payload)
    if (res.data.token && res.data.user) {
      setAuth(res.data.token, res.data.user)
      setUser(res.data.user)
    }
    return res.data
  }

  const logout = async () => {
    try {
      // Logout alone marks presence offline and deletes Sanctum tokens.
      // Do not heartbeat first — that would refresh last_used_at if logout then fails.
      await client.post('/logout')
    } catch {
      // Still clear local auth so the UI can leave; server tokens are swept if offline/stale.
    } finally {
      clearAuth()
      setUser(null)
    }
  }

  logoutRef.current = logout

  useEffect(() => {
    const handleUnload = () => {
      const token = localStorage.getItem('reservance_token')
      if (!token) return
      markOfflineOnUnload(token)
    }

    window.addEventListener('pagehide', handleUnload)
    window.addEventListener('beforeunload', handleUnload)
    return () => {
      window.removeEventListener('pagehide', handleUnload)
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

export function RoleRoute({ roles, children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) {
    window.location.href = '/login'
    return null
  }
  if (!roles.includes(user.role)) {
    return <div className="p-8 text-[#491464]">Access denied.</div>
  }
  return children
}
