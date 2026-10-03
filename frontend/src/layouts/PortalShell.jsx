import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import PortalNavIcon, { PortalUserIcon } from '../components/portal/PortalNavIcon'
import PortalBreadcrumb from '../components/PortalBreadcrumb'
import NotificationBell from '../components/NotificationBell'
import ProfileMenu from '../components/ProfileMenu'
import { useAuth } from '../context/AuthContext'
import { useGuardedNavigation } from '../context/ActivityFactoryGuardContext'
import './portal.css'

const SIDEBAR_STORAGE_KEY = 'reservance-portal-sidebar-open'

const defaultLinkClass = ({ isActive }) =>
  `block rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-[#ffb736] text-[#491464]' : 'text-[#fafafa]/90 hover:bg-[#712c83]'}`

const brandedLinkClass = ({ isActive }) =>
  `portal-nav-link${isActive ? ' portal-nav-link--active' : ''}`

function resolvePageLabel(pathname, nav) {
  const matches = [...nav]
    .sort((a, b) => b.to.length - a.to.length)
    .filter((item) => {
      if (item.end) return pathname === item.to
      return pathname === item.to || pathname.startsWith(`${item.to}/`)
    })

  return (matches[0]?.label || 'Dashboard').toUpperCase()
}

function readSidebarPreference() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

export default function PortalShell({ title, nav, homePath, branded = false }) {
  const { user } = useAuth()
  const location = useLocation()
  const { guardedNavigate, blocking } = useGuardedNavigation()
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarPreference)
  const pageLabel = resolvePageLabel(location.pathname, nav)

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarOpen))
    } catch {
      // ignore storage errors
    }
  }, [sidebarOpen])

  const toggleSidebar = () => setSidebarOpen((open) => !open)

  const handleCollapsedSidebarClick = (event) => {
    if (sidebarOpen) return
    if (event.target.closest('.portal-sidebar__edge-toggle')) return
    if (event.target.closest('a')) return
    setSidebarOpen(true)
  }

  const handleNavClick = (event, to, end) => {
    const isActive = end ? location.pathname === to : (location.pathname === to || location.pathname.startsWith(`${to}/`))
    if (isActive || !blocking) return
    event.preventDefault()
    guardedNavigate(to)
  }

  const sidebar = (
    <aside
      className={[
        branded ? 'portal-sidebar' : 'portal-sidebar portal-sidebar--plain flex shrink-0 flex-col bg-[#491464] text-[#fafafa]',
        sidebarOpen ? '' : 'portal-sidebar--collapsed',
      ].filter(Boolean).join(' ')}
      onClick={handleCollapsedSidebarClick}
      title={sidebarOpen ? undefined : 'Click sidebar to expand'}
    >
      <div className="portal-sidebar__head">
        {branded ? (
          <div className="portal-sidebar__brand">
            <img src="/logosymbol.png" alt="" className="portal-sidebar__symbol" width={52} height={52} />
            <img src="/logotext.png" alt="RESERVANCE" className="portal-sidebar__text" />
            <p className="portal-sidebar__role">{title}</p>
          </div>
        ) : (
          <div className="portal-sidebar__brand portal-sidebar__brand--plain">
            <p className="portal-sidebar__plain-mark">R</p>
            <p className="portal-sidebar__plain-title">{title}</p>
          </div>
        )}
      </div>

      <nav className={branded ? 'portal-sidebar__nav' : 'portal-sidebar__nav portal-sidebar__nav--plain flex-1 overflow-y-auto p-4'}>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => {
              const base = branded ? brandedLinkClass({ isActive }) : defaultLinkClass({ isActive })
              return `${base}${sidebarOpen ? '' : ' portal-nav-link--compact'}`
            }}
            end={item.end}
            onClick={(event) => handleNavClick(event, item.to, item.end)}
            title={item.label}
          >
            <PortalNavIcon label={item.label} to={item.to} />
            <span className="portal-nav-link__label">{item.label}</span>
            {!sidebarOpen && (
              <span className="portal-nav-link__flyout" role="tooltip">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={branded ? 'portal-sidebar__footer' : 'portal-sidebar__footer portal-sidebar__footer--plain border-t border-[#712c83] p-4 text-sm'}>
        {sidebarOpen ? (
          <p className={branded ? 'portal-sidebar__user' : 'font-semibold'}>{user?.name}</p>
        ) : (
          <div className="portal-sidebar__user-compact" title={user?.name}>
            <PortalUserIcon />
          </div>
        )}
        {branded && sidebarOpen ? (
          <p className="portal-sidebar__sig">
            RESERVANCE <span aria-hidden="true">•</span> 2026
          </p>
        ) : null}
      </div>

      <button
        type="button"
        className="portal-sidebar__edge-toggle"
        onClick={(event) => {
          event.stopPropagation()
          toggleSidebar()
        }}
        aria-label={sidebarOpen ? 'Collapse navigation' : 'Expand navigation'}
        aria-expanded={sidebarOpen}
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <svg className="portal-sidebar__edge-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </aside>
  )

  const header = (
    <header className={branded ? 'portal-header' : 'portal-header portal-header--plain'}>
      <PortalBreadcrumb homePath={homePath} pageLabel={pageLabel} />
      <div className="portal-header__actions">
        <NotificationBell branded={branded} />
        <ProfileMenu />
      </div>
    </header>
  )

  const shellClass = [
    branded ? 'portal-shell portal-shell--branded' : 'portal-shell flex h-full min-h-0',
    sidebarOpen ? '' : 'portal-shell--sidebar-collapsed',
  ].filter(Boolean).join(' ')

  if (branded) {
    return (
      <div className={shellClass}>
        {sidebar}
        <div className="portal-main">
          {header}
          <main className="portal-content">
            <Outlet />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className={shellClass}>
      {sidebar}
      <div className="portal-main flex min-w-0 flex-1 flex-col">
        {header}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
