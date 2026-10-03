import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useRefreshTick } from '../context/RealtimeContext'

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 17H9c-2.2 0-4-1.8-4-4V11c0-3.1 2.4-5.6 5.5-5.9V4a2.5 2.5 0 1 1 5 0v1.1c3.1.3 5.5 2.8 5.5 5.9v2c0 2.2-1.8 4-4 4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

export default function NotificationBell({ branded = false }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const refreshTick = useRefreshTick()

  const load = useCallback(() => {
    client.get('/notifications').then((res) => setItems(res.data.notifications || [])).catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshTick])

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

  const unread = items.filter((n) => !n.read_at).length

  const markRead = async (recipientId) => {
    try {
      await client.patch(`/notifications/${recipientId}/read`)
      load()
    } catch {
      /* ignore */
    }
  }

  const buttonClass = branded ? 'portal-notify-btn' : 'rounded-lg border border-[#5c297c]/20 px-3 py-2 text-sm font-semibold text-[#491464]'
  const panelClass = branded ? 'portal-notify-panel' : 'absolute right-0 z-20 mt-2 w-72 rounded-xl border border-[#5c297c]/15 bg-[#fafafa] p-3 shadow-lg'

  return (
    <div className={`portal-notify ${branded ? '' : 'relative'}`} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={buttonClass}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
      >
        <BellIcon />
        {unread > 0 && <span className="portal-notify-btn__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className={panelClass} role="menu">
          <p className="portal-notify-panel__title">Notifications</p>
          {items.length === 0 ? (
            <p className="portal-notify-panel__empty">No notifications yet.</p>
          ) : (
            items.slice(0, 10).map((item) => {
              const activityId = item.notification?.data?.activity_id
              const activityType = item.notification?.data?.activity_type
              const studentPath = activityType === 'simulation'
                ? `/student/activities/${activityId}/simulate`
                : `/student/activities/${activityId}/play`
              return (
                <div
                  key={item.id}
                  className={`portal-notify-item ${item.read_at ? '' : 'portal-notify-item--unread'}`}
                  role="menuitem"
                >
                  <p className="portal-notify-item__title">{item.notification?.title}</p>
                  <p className="portal-notify-item__body">{item.notification?.body}</p>
                  <div className="portal-notify-item__actions">
                    {activityId && user?.role === 'student' && (
                      <Link to={studentPath} className="portal-notify-item__link" onClick={() => setOpen(false)}>
                        Open activity
                      </Link>
                    )}
                    {!item.read_at && (
                      <button type="button" className="portal-notify-item__read" onClick={() => markRead(item.id)}>
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
