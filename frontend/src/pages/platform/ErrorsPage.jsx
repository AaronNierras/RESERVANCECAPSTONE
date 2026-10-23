import { useState } from 'react'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

function formatWhen(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

export default function ErrorsPage() {
  const [errors, setErrors] = useState([])

  const load = () => client.get('/platform/errors').then((res) => setErrors(res.data.errors || []))
  useAutoRefresh(load, [])

  const toggle = async (row) => {
    await client.patch(`/platform/errors/${row.id}`, { is_fixed: !row.is_fixed })
    load()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Errors"
        description="Unexpected problems are listed here so the rest of RESERVANCE can keep working. Mark a row when it has been fixed."
      />
      {errors.length === 0 ? (
        <p className="registry-empty">No errors have been recorded.</p>
      ) : (
        <ul className="space-y-3">
          {errors.map((row) => (
            <li key={row.id} className="card-gold-border p-4">
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={row.is_fixed} onChange={() => toggle(row)} />
                <span>
                  <span className="block font-bold text-[#491464]">{row.message}</span>
                  <span className="block text-sm text-[#5c297c]">
                    {row.location || row.source} · {row.user || 'System'} · {formatWhen(row.created_at)}
                    {row.is_fixed ? ` · Fixed ${formatWhen(row.fixed_at)}` : ''}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
