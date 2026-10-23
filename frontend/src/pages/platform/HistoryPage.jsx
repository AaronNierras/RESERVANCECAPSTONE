import { useEffect, useState } from 'react'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'

function formatWhen(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

export default function HistoryPage({ endpoint, title, description, allowRoleFilter = false }) {
  const [role, setRole] = useState('self')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const params = { role: allowRoleFilter ? role : 'self' }
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    client.get(endpoint, { params })
      .then((res) => {
        setRows(res.data.history || [])
        setError('')
      })
      .catch((err) => setError(err.response?.data?.errors?.date_to?.[0] || 'Unable to load history.'))
  }, [endpoint, role, dateFrom, dateTo, allowRoleFilter])

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <div className="grid gap-3 md:grid-cols-3">
        {allowRoleFilter && (
          <div className="form-field">
            <label htmlFor="history-role">Whose history</label>
            <select id="history-role" value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border px-3 py-2">
              <option value="self">Superadmin</option>
              <option value="program_chair">Program Chair</option>
              <option value="faculty">Faculty</option>
            </select>
          </div>
        )}
        <div className="form-field">
          <label htmlFor="history-from">From</label>
          <input id="history-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border px-3 py-2" />
        </div>
        <div className="form-field">
          <label htmlFor="history-to">To</label>
          <input id="history-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border px-3 py-2" />
        </div>
      </div>
      {error && <p className="form-field__error">{error}</p>}
      {rows.length === 0 ? (
        <p className="registry-empty">No history for this filter.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="card-gold-border p-3 text-sm">
              <p className="font-bold text-[#491464]">{row.action?.replaceAll('_', ' ')}</p>
              <p className="text-[#5c297c]">{row.user || 'Unknown user'} · {row.module} · {formatWhen(row.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
