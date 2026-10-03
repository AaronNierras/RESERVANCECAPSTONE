import { createContext, useContext, useEffect, useRef, useState } from 'react'
import client, { clearAuth, getStoredUser, setAuth } from '../api/client'
import LoadingScreen from '../components/LoadingScreen'

const AuthContext = createContext(null)
const IDLE_MS = 10 * 60 * 1000
const HEARTBEAT_MS = 30000
const PRESENCE_ROLES = new Set(['student', 'faculty'])

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
        await client.post('/presence/heartbeat', { status: 'offline' })
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

  const logout = async () => {
    try {
      await client.post('/presence/heartbeat', { status: 'offline' })
      await client.post('/logout')
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
      fetch(`${import.meta.env.VITE_API_URL}/presence/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'offline' }),
        keepalive: true,
      }).catch(() => {})
    }

    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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
