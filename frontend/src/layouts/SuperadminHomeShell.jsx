import PortalShell from './PortalShell'

const nav = [
  { to: '/superadmin', label: 'Dashboard', end: true },
  { to: '/superadmin/students', label: 'Students' },
  { to: '/superadmin/faculty', label: 'Faculty' },
  { to: '/superadmin/history', label: 'History' },
  { to: '/superadmin/errors', label: 'Errors' },
]

export default function SuperadminHomeShell() {
  return (
    <PortalShell
      title="Superadmin"
      nav={nav}
      homePath="/superadmin"
      branded
    />
  )
}
