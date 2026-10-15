import PortalShell from './PortalShell'

const nav = [
  { to: '/superadmin', label: 'Home', end: true },
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
