import { useCallback, useEffect, useState } from 'react'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'
import { useRefreshTick } from '../../context/RealtimeContext'

export default function FacultyMonitorPage() {
  const [attempts, setAttempts] = useState([])
  const refreshTick = useRefreshTick()

  const load = useCallback(() => {
    client.get('/faculty/monitor').then((res) => setAttempts(res.data.attempts)).catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshTick])

  return (
    <div className="space-y-8">
      <PageHeader title="Live Monitor" description="Active student attempts." />
      <div className="card-gold-border overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3edf7]"><tr><th className="p-3">Student</th><th className="p-3">Activity</th><th className="p-3">Question</th><th className="p-3">Time left</th><th className="p-3">Status</th></tr></thead>
          <tbody>
            {attempts.map((a, i) => (
              <tr key={i} className="border-t">
                <td className="p-3">{a.student}</td>
                <td className="p-3">{a.activity}</td>
                <td className="p-3">{a.question}</td>
                <td className="p-3">{a.time_remaining != null ? `${a.time_remaining}s` : '—'}</td>
                <td className="p-3">{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
