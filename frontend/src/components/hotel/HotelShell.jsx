import { useState } from 'react'

const TABS = [
  { id: 'reservations', label: '1. Book', fullLabel: 'Book reservation' },
  { id: 'checkin', label: '2. Check in', fullLabel: 'Check in guest' },
  { id: 'checkout', label: '3. Check out', fullLabel: 'Check out & pay' },
]

export default function HotelShell({
  hotelName,
  activityTitle,
  timerLabel,
  activeTab,
  onTabChange,
  sidebar,
  panel,
  footer,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const activeIndex = TABS.findIndex((t) => t.id === activeTab)

  const toggleSidebar = () => setSidebarOpen((open) => !open)

  return (
    <div className={`hotel-shell${sidebarOpen ? '' : ' hotel-shell--sidebar-collapsed'}`}>
      <header className="hotel-shell__header">
        <div className="hotel-shell__header-start">
          <button
            type="button"
            className="hotel-shell__burger"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Hide room board' : 'Show room board'}
            aria-expanded={sidebarOpen}
            title={sidebarOpen ? 'Hide room board' : 'Show room board'}
          >
            <span className="hotel-shell__burger-icon" aria-hidden="true" />
          </button>
          <div className="hotel-shell__header-main">
            <div className="hotel-shell__brand">{hotelName}</div>
            <div className="hotel-shell__meta">{activityTitle}</div>
          </div>
        </div>
        {timerLabel && (
          <div className="hotel-shell__timer" title="Time remaining">
            ⏱ {timerLabel}
          </div>
        )}
      </header>

      <nav className="hotel-shell__stepper" aria-label="Front desk steps">
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            type="button"
            className={`hotel-shell__step${activeTab === tab.id ? ' is-active' : ''}${i < activeIndex ? ' is-done' : ''}`}
            onClick={() => onTabChange(tab.id)}
            title={tab.fullLabel}
          >
            <span className="hotel-shell__step-num">{i + 1}</span>
            <span className="hotel-shell__step-label">{tab.label.replace(/^\d+\.\s*/, '')}</span>
          </button>
        ))}
      </nav>

      <div className="hotel-shell__layout">
        <aside className={`hotel-shell__sidebar${sidebarOpen ? '' : ' is-collapsed'}`}>
          {sidebarOpen ? (
            sidebar
          ) : (
            <button
              type="button"
              className="hotel-sidebar-rail"
              onClick={toggleSidebar}
              title="Show room board"
              aria-label="Show room board"
            >
              <span className="hotel-sidebar-rail__icon" aria-hidden="true" />
              <span className="hotel-sidebar-rail__label">Rooms</span>
            </button>
          )}
        </aside>
        <main className="hotel-shell__workspace">{panel}</main>
      </div>

      {footer && <footer className="hotel-footer">{footer}</footer>}
    </div>
  )
}
