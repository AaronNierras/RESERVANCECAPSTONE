import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'
import '../styles/academic.css'

const ROLE_LABELS = {
  program_chair: 'Program Chair',
  super_admin: 'Superadmin',
  faculty: 'Faculty',
  student: 'Student',
}

function initials(name) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default function ProfileMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const handleClickOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const requestLogout = () => {
    setOpen(false)
    if (user?.role === 'student') {
      setConfirmOpen(true)
      return
    }
    logout().then(() => navigate('/login', { replace: true }))
  }

  const confirmLogout = async () => {
    if (busy) return
    setBusy(true)
    try {
      await logout()
      setConfirmOpen(false)
      navigate('/login', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="portal-profile" ref={rootRef}>
      <button
        type="button"
        className="portal-profile__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Open profile menu"
      >
        <span className="portal-profile__avatar" aria-hidden="true">
          {initials(user?.name)}
        </span>
      </button>

      {open && (
        <div className="portal-profile__menu" role="menu">
          <div className="portal-profile__details">
            <p className="portal-profile__name">{user?.name}</p>
            <p className="portal-profile__email">{user?.email}</p>
            <p className="portal-profile__role">
              {ROLE_LABELS[user?.role] || user?.role || 'User'}
            </p>
          </div>
          <button type="button" className="portal-profile__logout" onClick={requestLogout} role="menuitem">
            Log out
          </button>
        </div>
      )}

      <Modal
        open={confirmOpen}
        title="Log out?"
        onClose={() => !busy && setConfirmOpen(false)}
        footer={(
          <>
            <button
              type="button"
              className="rounded-lg border border-[#5c297c]/20 px-4 py-2 text-sm font-semibold text-[#491464]"
              onClick={() => setConfirmOpen(false)}
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
      </Modal>
    </div>
  )
}
