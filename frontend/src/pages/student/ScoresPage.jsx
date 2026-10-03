import { useState } from 'react'
import client from '../../api/client'
import LoadingScreen from '../../components/LoadingScreen'
import PageHeader from '../../components/PageHeader'
import StatCard from '../../components/StatCard'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

export default function StudentScoresPage() {
  const [data, setData] = useState(null)

  const load = () => client.get('/student/scores').then((res) => setData(res.data))
  useAutoRefresh(load, [])

  if (!data) {
    return (
      <div className="space-y-8">
        <PageHeader title="Scores" description="Summary and per-question breakdown." />
        <LoadingScreen compact fullscreen={false} message="Loading scores…" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Scores" description="Summary and per-question breakdown." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Average" value={`${data.summary.average ?? 0}%`} />
        <StatCard label="Highest" value={`${data.summary.highest ?? 0}%`} />
        <StatCard label="Lowest" value={`${data.summary.lowest ?? 0}%`} />
      </div>
      {data.records.map((record) => (
        <div key={record.id} className="card-gold-border p-4">
          <h3 className="font-bold text-[#491464]">{record.activity?.title}</h3>
          <p className="text-sm text-[#5c297c]">Score: {record.score?.percentage}% · Accuracy: {record.score?.accuracy}%</p>
          <ul className="mt-3 space-y-1 text-sm">
            {(record.score?.details?.criteria || []).map((c) => (
              <li key={c.key} className={`border-t border-[#5c297c]/10 pt-2 ${c.passed ? 'text-green-800' : 'text-red-800'}`}>
                {c.label}: {c.earned}/{c.points} pts
              </li>
            ))}
            {(record.score?.breakdowns || []).map((b) => (
              <li key={b.id} className="border-t border-[#5c297c]/10 pt-2">
                Your answer: {b.student_answer || '—'} · Correct: {b.correct_answer} · Points: {b.points}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
