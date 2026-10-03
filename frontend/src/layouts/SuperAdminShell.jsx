import PortalShell from './PortalShell'

const nav = [
  { to: '/superadmin/dashboard', label: 'Dashboard', end: true },
  { to: '/superadmin/activities-factory', label: 'Activity Factory' },
  { to: '/superadmin/activities', label: 'Faculty Activities' },
  { to: '/superadmin/templates', label: 'Templates' },
  { to: '/superadmin/analytics', label: 'Analytics' },
  { to: '/superadmin/programs', label: 'Programs' },
  { to: '/superadmin/students', label: 'Students' },
  { to: '/superadmin/faculty', label: 'Faculty' },
]

export default function SuperAdminShell() {
  return (
    <PortalShell
      title="Superadmin"
      nav={nav}
      homePath="/superadmin/dashboard"
      branded
    />
  )
}
