const ICONS = {
  home: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  ),
  dashboard: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  ),
  activities: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <rect x="9" y="3" width="6" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9 12h6M9 16h4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 8v4l3 2" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  scores: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19V5M4 19h16M8 15l3-3 3 2 4-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  leaderboards: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 17V7M12 17V4M16 17v-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M5 17h14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  badges: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="9" r="5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8.5 13.5 7 20l5-2.5L17 20l-1.5-6.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  ),
  tutorial: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 5.5h12a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 8h8M8 12h8M8 16h5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  students: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M16 11.5a2.5 2.5 0 1 0 0-5M19 19c0-2-1.2-3.7-3-4.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  templates: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9 8h6M9 12h6M9 16h4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 19V9M12 19V5M19 19v-7" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  monitor: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 21h8M12 17v4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="11" r="2" fill="currentColor" />
    </svg>
  ),
  programs: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h12M6 12h12M6 17h12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="4" cy="7" r="1" fill="currentColor" />
      <circle cx="4" cy="12" r="1" fill="currentColor" />
      <circle cx="4" cy="17" r="1" fill="currentColor" />
    </svg>
  ),
  faculty: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="7" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M6 19c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M17 8.5h3M18.5 7v3" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  default: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  ),
}

export function resolveNavIconKey(label, to = '') {
  const normalizedLabel = String(label || '').toLowerCase()
  const normalizedTo = String(to || '').toLowerCase()

  if (normalizedLabel === 'home' || /\/student\/?$/.test(normalizedTo)) return 'home'
  if (normalizedLabel === 'dashboard' || normalizedTo.includes('dashboard')) return 'dashboard'
  if (normalizedLabel.includes('tutorial')) return 'tutorial'
  if (normalizedLabel.includes('leaderboard')) return 'leaderboards'
  if (normalizedLabel.includes('achievement') || normalizedLabel.includes('badge')) return 'badges'
  if (normalizedLabel.includes('history') || normalizedLabel.includes('recent')) return 'history'
  if (normalizedLabel.includes('score')) return 'scores'
  if (normalizedLabel.includes('template')) return 'templates'
  if (normalizedLabel.includes('analytics')) return 'analytics'
  if (normalizedLabel.includes('monitor')) return 'monitor'
  if (normalizedLabel.includes('program')) return 'programs'
  if (normalizedLabel.includes('activity') || normalizedLabel.includes('factory')) return 'activities'
  if (normalizedLabel === 'faculty' || (normalizedTo.includes('/faculty') && !normalizedTo.includes('activit'))) return 'faculty'
  if (normalizedLabel.includes('student')) return 'students'

  return 'default'
}

export default function PortalNavIcon({ label, to, className = '' }) {
  const key = resolveNavIconKey(label, to)
  return (
    <span className={`portal-nav-link__icon${className ? ` ${className}` : ''}`}>
      {ICONS[key] || ICONS.default}
    </span>
  )
}

export function PortalUserIcon({ className = '' }) {
  return (
    <span className={`portal-nav-link__icon portal-sidebar__user-icon${className ? ` ${className}` : ''}`}>
      {ICONS.user}
    </span>
  )
}
