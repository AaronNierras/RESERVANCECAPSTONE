import PortalShell from './PortalShell'

const nav = [
  { to: '/faculty/students', label: 'Students', end: true },
  { to: '/faculty/activities', label: 'Activity Factory' },
  { to: '/faculty/achievements', label: 'Achievements' },
]

export default function FacultyShell() {
  return <PortalShell title="Faculty" nav={nav} homePath="/faculty/students" branded />
}
