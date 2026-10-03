import { NavLink, useLocation } from 'react-router-dom'
import { useGuardedNavigation } from '../context/ActivityFactoryGuardContext'

export default function PortalBreadcrumb({ homePath, pageLabel }) {
  const location = useLocation()
  const { guardedNavigate, blocking } = useGuardedNavigation()

  const handleHomeClick = (event) => {
    if (location.pathname === homePath || !blocking) return
    event.preventDefault()
    guardedNavigate(homePath)
  }

  return (
    <nav className="portal-breadcrumb" aria-label="Breadcrumb">
      <NavLink to={homePath} className="portal-breadcrumb__root" onClick={handleHomeClick}>
        RESERVANCE
      </NavLink>
      <span className="portal-breadcrumb__sep" aria-hidden="true">
        &gt;
      </span>
      <span className="portal-breadcrumb__current">{pageLabel}</span>
    </nav>
  )
}
