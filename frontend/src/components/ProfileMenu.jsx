import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const ROLE_LABELS = {
  super_admin: 'Super Admin',
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
  const [open, setOpen] = useState(false)
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

  const handleLogout = async () => {
    setOpen(false)
    await logout()
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
          <button type="button" className="portal-profile__logout" onClick={handleLogout} role="menuitem">
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
