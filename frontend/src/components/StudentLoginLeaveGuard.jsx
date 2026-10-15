import { useEffect, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'
import '../styles/academic.css'

function homePathFor(user) {
  if (!user) return '/login'
  if (user.role === 'program_chair') return '/program-chair/dashboard'
  if (user.role === 'super_admin') return '/superadmin'
  if (user.role === 'faculty') return '/faculty/students'
  return '/student'
}

/**
 * When a signed-in student tries to open /login (browser Back or edited URL),
 * ask before logging them out.
 */
export default function StudentLoginLeaveGuard() {
  const { user, logout } = useAuth()
  const [busy, setBusy] = useState(false)

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!user || user.role !== 'student') return false
    if (nextLocation.pathname !== '/login') return false
    if (currentLocation.pathname === '/login') return false
    return true
  })

  useEffect(() => {
    if (blocker.state !== 'blocked') setBusy(false)
  }, [blocker.state])

  const staySignedIn = () => {
    if (blocker.state === 'blocked') blocker.reset()
  }

  const confirmLogout = async () => {
    if (busy) return
    setBusy(true)
    try {
      await logout()
      if (blocker.state === 'blocked') blocker.proceed()
    } catch {
      setBusy(false)
    }
  }

  if (blocker.state !== 'blocked') return null

  return (
    <Modal
      open
      title="Log out?"
      onClose={staySignedIn}
      footer={(
        <>
          <button
            type="button"
            className="rounded-lg border border-[#5c297c]/20 px-4 py-2 text-sm font-semibold text-[#491464]"
            onClick={staySignedIn}
            disabled={busy}
          >
            Stay signed in
          </button>
          <button
            type="button"
            className="rounded-lg bg-[#491464] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={confirmLogout}
            disabled={busy}
          >
            {busy ? 'Signing out…' : 'Log out'}
          </button>
        </>
      )}
    >
      <p className="text-sm leading-relaxed text-[#5c297c]">
        Are you sure you want to log out?
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[#5c297c]">
        You are trying to leave your student session and go to the login page.
      </p>
    </Modal>
  )
}

export { homePathFor }
