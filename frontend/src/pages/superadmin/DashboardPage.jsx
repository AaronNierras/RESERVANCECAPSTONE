import client from '../../api/client'
import { useEffect, useState } from 'react'
import LoadingScreen from '../../components/LoadingScreen'
import DashboardStatCard from '../../components/dashboard/DashboardStatCard'
import QuickActionCard from '../../components/dashboard/QuickActionCard'
import RecentActivity from '../../components/dashboard/RecentActivity'
import PageHeader from '../../components/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { useRefreshTick } from '../../context/RealtimeContext'
import '../../styles/dashboard.css'

function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16 11a4 4 0 1 0-8 0M3 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconOnline() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 5v1.5M12 17.5V19M6.2 6.2l1.1 1.1M16.7 16.7l1.1 1.1M5 12H6.5M17.5 12H19" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconActivity() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function timeOfDay(date) {
  const hour = date.getHours()
  if (hour >= 5 && hour < 11) return { phase: 'sunrise', greeting: 'Good morning' }
  if (hour >= 11 && hour < 17) return { phase: 'day', greeting: 'Good afternoon' }
  if (hour >= 17 && hour < 19) return { phase: 'sunset', greeting: 'Good evening' }
  return { phase: 'night', greeting: 'Good night' }
}

function SkyIcon({ phase }) {
  if (phase === 'sunrise') {
    return (
      <svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <path d="M18 78h84" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M34 78a26 26 0 0 1 52 0" stroke="currentColor" strokeWidth="4" />
        <path d="M60 28v10M34 40l8 8M86 40l-8 8M28 62h10M82 62h10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    )
  }
  if (phase === 'day') {
    return (
      <svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <circle cx="60" cy="60" r="22" stroke="currentColor" strokeWidth="4" />
        <path d="M60 18v12M60 90v12M18 60h12M90 60h12M30 30l8 8M82 82l8 8M90 30l-8 8M38 82l-8 8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    )
  }
  if (phase === 'sunset') {
    return (
      <svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <path d="M16 86h88" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M32 86a28 28 0 0 1 56 0" stroke="currentColor" strokeWidth="4" />
        <path d="M60 34v12M36 48l8 8M84 48l-8 8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <path d="M74 28a28 28 0 1 0 18 48 24 24 0 1 1-18-48z" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <path d="M28 36h2M40 24h2M26 52h2M92 30h2M100 46h2" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export default function SuperAdminDashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [activityPage, setActivityPage] = useState(1)
  const [now, setNow] = useState(() => new Date())
  const refreshTick = useRefreshTick()

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    client
      .get('/super-admin/dashboard', { params: { activity_page: activityPage } })
      .then((res) => {
        if (!cancelled) setData(res.data)
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load dashboard data.')
      })
    return () => {
      cancelled = true
    }
  }, [refreshTick, activityPage])

  if (error) {
    return (
      <div className="dash-page">
        <PageHeader title="Dashboard" description="System overview." />
        <p className="dash-empty">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="dash-page">
        <PageHeader title="Dashboard" description="System overview." />
        <LoadingScreen compact fullscreen={false} message="Loading dashboard…" />
      </div>
    )
  }

  const { users, activities } = data
  const totalUsers = users.students + users.faculty
  const onlineUsers = users.online_students + users.online_faculty
  const activeNow = activities.published ?? 0
  const scheduled = activities.scheduled ?? 0
  const displayName = user?.name || 'Program Chair'
  const { phase, greeting } = timeOfDay(now)

  return (
    <div className="dash-page">
      <section className={`dash-welcome dash-welcome--${phase}`} aria-label="Welcome">
        <div className="dash-welcome__copy">
          <p className="dash-welcome__greeting" key={phase}>{greeting}, {displayName}</p>
          <p className="dash-welcome__text">Here&apos;s what&apos;s happening in RESERVANCE today.</p>
          <p className="dash-welcome__meta">
            {totalUsers} registered accounts • {onlineUsers} currently online
          </p>
        </div>
        <div className="dash-welcome__sky" aria-hidden="true">
          <div className="dash-welcome__sky-float" key={phase}>
            <SkyIcon phase={phase} />
          </div>
        </div>
      </section>

      <section aria-labelledby="dash-overview-heading">
        <h2 id="dash-overview-heading" className="dash-section-title">System overview</h2>
        <div className="dash-overview__grid">
          <DashboardStatCard
            tone="plum"
            icon={<IconUsers />}
            label="Total users"
            value={totalUsers}
            hint="Registered accounts"
            breakdown={[
              { label: 'Students', value: users.students },
              { label: 'Faculty', value: users.faculty },
            ]}
          />
          <DashboardStatCard
            tone="plum"
            icon={<IconOnline />}
            label="Online now"
            value={onlineUsers}
            hint={onlineUsers === 0 ? 'No users are currently online' : 'Students and faculty online'}
            breakdown={[
              { label: 'Students online', value: users.online_students },
              { label: 'Faculty online', value: users.online_faculty },
            ]}
          />
          <DashboardStatCard
            tone="violet"
            icon={<IconActivity />}
            label="Active activities"
            value={activeNow}
            hint={activeNow === 0 ? 'No activities are currently running' : 'Activities currently running'}
          />
          <DashboardStatCard
            tone="ink"
            icon={<IconCalendar />}
            label="Scheduled activities"
            value={scheduled}
            hint={scheduled === 0 ? 'No activities are scheduled' : 'Activities scheduled to open'}
          />
        </div>
      </section>

      <section aria-labelledby="dash-actions-heading">
        <h2 id="dash-actions-heading" className="dash-section-title">Quick actions</h2>
        <div className="dash-actions">
          <QuickActionCard
            tone="plum"
            to="/superadmin/students"
            icon={<IconUsers />}
            title="Manage students"
            description="View and manage student accounts"
          />
          <QuickActionCard
            tone="violet"
            to="/superadmin/faculty"
            icon={<IconUsers />}
            title="Manage faculty"
            description="View and manage faculty accounts"
          />
          <QuickActionCard
            tone="plum"
            to="/superadmin/activities-factory"
            icon={<IconActivity />}
            title="Manage activities"
            description="Create and manage assessment activities"
          />
          <QuickActionCard
            tone="ink"
            to="/superadmin/activities"
            icon={<IconCalendar />}
            title="Faculty activities"
            description="Review activities created by faculty"
          />
        </div>
      </section>

      <RecentActivity
        items={data.recent_activity?.data || []}
        page={data.recent_activity?.current_page || 1}
        lastPage={data.recent_activity?.last_page || 1}
        total={data.recent_activity?.total || 0}
        onPageChange={setActivityPage}
      />
    </div>
  )
}
