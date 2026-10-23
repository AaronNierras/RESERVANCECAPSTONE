import { useMemo, useState } from 'react'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import '../../styles/analytics.css'

function formatWhen(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString()
}

export default function AchievementsPage({ endpoint, printable = false }) {
  const [badges, setBadges] = useState([])
  const [openId, setOpenId] = useState(null)
  const [sort, setSort] = useState('earned-desc')

  const load = () => client.get(endpoint).then((res) => setBadges(res.data.achievements || []))
  useAutoRefresh(load, [endpoint])

  const rows = useMemo(() => [...badges].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name)
    if (sort === 'earned-asc') return a.earned_count - b.earned_count || a.name.localeCompare(b.name)
    return b.earned_count - a.earned_count || a.name.localeCompare(b.name)
  }), [badges, sort])

  return (
    <div className="analytics-page">
      <PageHeader title="Achievements" description="How many students have earned each achievement." />
      <div className="flex flex-wrap items-end justify-between gap-3 no-print">
        <div className="form-field">
          <label htmlFor="achievement-sort">Sort</label>
          <select id="achievement-sort" value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border px-3 py-2">
            <option value="earned-desc">Most students</option>
            <option value="earned-asc">Fewest students</option>
            <option value="name">Name</option>
          </select>
        </div>
        {printable && (
          <button type="button" className="rounded-lg bg-[#ffb736] px-4 py-2 font-bold text-[#491464]" onClick={() => window.print()}>
            Print
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="registry-empty">No achievements yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((badge) => {
            const open = openId === badge.id
            return (
              <li key={badge.id} className="card-gold-border p-4">
                <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpenId(open ? null : badge.id)}>
                  <span>
                    <span className="block font-bold text-[#491464]">{badge.name}</span>
                    <span className="block text-sm text-[#5c297c]">{badge.description}</span>
                  </span>
                  <span className="text-sm font-bold text-[#491464]">{badge.earned_count} student{badge.earned_count === 1 ? '' : 's'} · {open ? 'Close' : 'Open'}</span>
                </button>
                {open && (
                  badge.students?.length ? (
                    <ul className="mt-3 space-y-1 text-sm text-[#5c297c]">
                      {badge.students.map((student) => (
                        <li key={`${badge.id}-${student.name}-${student.earned_at}`}>{student.name} · {formatWhen(student.earned_at)}</li>
                      ))}
                    </ul>
                  ) : <p className="mt-3 text-sm text-[#5c297c]">No student has earned this yet.</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
