import PortalShell from './PortalShell'

const nav = [
  { to: '/student', label: 'Home', end: true },
  { to: '/student/activities', label: 'Activities' },
  { to: '/student/history', label: 'History' },
  { to: '/student/scores', label: 'Scores' },
  { to: '/student/leaderboards', label: 'Leaderboards' },
  { to: '/student/badges', label: 'Badges' },
  { to: '/student/tutorial', label: 'Tutorial' },
]

export default function StudentShell() {
  return <PortalShell title="Student" nav={nav} homePath="/student" branded />
}
