import { useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

export default function StudentActivitiesPage() {
  const [activities, setActivities] = useState([])

  const load = () => client.get('/student/activities').then((res) => setActivities(res.data.activities || []))
  useAutoRefresh(load, [])

  const buckets = [
    { key: 'available', label: 'Available' },
    { key: 'ongoing', label: 'In progress' },
    { key: 'completed', label: 'Completed' },
  ]

  return (
    <div className="space-y-8">
      <PageHeader title="Activities" description="Open activities assigned to you. One attempt per activity." />

      {activities.length === 0 ? (
        <div className="card-gold-border p-6 text-center">
          <p className="font-bold text-[#491464]">No activities available right now.</p>
          <p className="mt-2 text-sm text-[#5c297c]">
            Activities appear here after your professor publishes and opens them for your class.
            Check the notification bell for new activity alerts.
          </p>
        </div>
      ) : (
        buckets.map(({ key, label }) => {
          const items = activities.filter((a) => a.bucket === key)
          if (!items.length) return null
          return (
            <section key={key}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#5c297c]">{label}</h2>
              <div className="grid gap-3">
                {items.map((a) => (
                  <div key={a.id} className="card-gold-border flex items-center justify-between p-4">
                    <div>
                      <p className="font-bold text-[#491464]">{a.title}</p>
                      <p className="text-sm text-[#5c297c]">{a.type} · {a.attempt_status || 'not started'}</p>
                    </div>
                    {a.bucket !== 'completed' && (
                      <Link
                        to={a.type === 'simulation' || a.attempt_status === 'simulation_pending'
                          ? `/student/activities/${a.id}/simulate`
                          : `/student/activities/${a.id}/play`}
                        className="rounded-lg bg-[#ffb736] px-4 py-2 text-sm font-bold text-[#491464]"
                      >
                        {a.bucket === 'ongoing' ? 'Continue' : 'Start'}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
