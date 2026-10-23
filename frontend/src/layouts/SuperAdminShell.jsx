import PortalShell from './PortalShell'

const nav = [
  { to: '/program-chair/dashboard', label: 'Dashboard', end: true },
  { to: '/program-chair/activities-factory', label: 'Activity Factory' },
  { to: '/program-chair/activities', label: 'Faculty Activities' },
  { to: '/program-chair/templates', label: 'Templates' },
  { to: '/program-chair/analytics', label: 'Analytics' },
  { to: '/program-chair/programs', label: 'Programs' },
  { to: '/program-chair/faculty', label: 'Faculty' },
  { to: '/program-chair/registration', label: 'Registration' },
  { to: '/program-chair/history', label: 'Recent activity' },
  { to: '/program-chair/achievements', label: 'Achievements' },
]

export default function SuperAdminShell() {
  return (
    <PortalShell
      title="Program Chair"
      nav={nav}
      homePath="/program-chair/dashboard"
      branded
    />
  )
}
