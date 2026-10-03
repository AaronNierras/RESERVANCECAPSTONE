import { useState } from 'react'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

export default function StudentHistoryPage() {
  const [history, setHistory] = useState([])

  const load = () => client.get('/student/history').then((res) => setHistory(res.data.history))
  useAutoRefresh(load, [])

  return (
    <div className="space-y-8">
      <PageHeader title="History" description="Past activity attempts." />
      <div className="card-gold-border overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3edf7]"><tr><th className="p-3">Activity</th><th className="p-3">Date</th><th className="p-3">Score</th><th className="p-3">Status</th></tr></thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-3">{row.activity?.title}</td>
                <td className="p-3">{row.date ? new Date(row.date).toLocaleString() : '—'}</td>
                <td className="p-3">{row.score != null ? `${row.score}%` : '—'}</td>
                <td className="p-3">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
