import { useEffect, useState } from 'react'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'
import LoadingScreen from '../../components/LoadingScreen'

export default function PlatformDashboardPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    client.get('/platform/dashboard')
      .then((res) => setData(res.data))
      .catch(() => setError('Unable to load the Superadmin dashboard.'))
  }, [])

  if (!data && !error) {
    return <LoadingScreen compact fullscreen={false} message="Loading dashboard…" />
  }

  const cards = data ? [
    ['Students registered', data.students_registered],
    ['Faculty registered', data.faculty_registered],
    ['Students online', data.students_online],
    ['Students offline', data.students_offline],
    ['Faculty online', data.faculty_online],
    ['Faculty offline', data.faculty_offline],
  ] : []

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Registered accounts and who is online right now." />
      {error && <p className="form-field__error">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <article key={label} className="card-gold-border p-5">
            <p className="text-sm font-semibold text-[#5c297c]">{label}</p>
            <p className="mt-2 text-3xl font-extrabold text-[#491464]">{value}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
