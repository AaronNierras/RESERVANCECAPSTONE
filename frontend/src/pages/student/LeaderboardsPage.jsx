import { useState } from 'react'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

export default function LeaderboardsPage() {
  const [scope, setScope] = useState('semester')
  const [rows, setRows] = useState([])

  const load = () => client.get('/leaderboards', { params: { scope } }).then((res) => setRows(res.data.leaderboard))
  useAutoRefresh(load, [scope])

  return (
    <div className="space-y-8">
      <PageHeader title="Leaderboards" description="Top performers." />
      <div className="flex gap-2">
        {['activity', 'program', 'semester'].map((s) => (
          <button key={s} type="button" onClick={() => setScope(s)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${scope === s ? 'bg-[#ffb736] text-[#491464]' : 'bg-[#f3edf7] text-[#5c297c]'}`}>{s}</button>
        ))}
      </div>
      <div className="card-gold-border overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3edf7]"><tr><th className="p-3">Rank</th><th className="p-3">Student</th><th className="p-3">Score</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t"><td className="p-3">#{r.rank}</td><td className="p-3">{r.student?.name}</td><td className="p-3">{r.composite_score}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
