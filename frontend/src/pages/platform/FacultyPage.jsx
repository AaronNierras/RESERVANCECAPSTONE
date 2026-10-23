import { useMemo, useState } from 'react'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

export default function PlatformFacultyPage() {
  const [faculty, setFaculty] = useState([])
  const [sort, setSort] = useState('name')
  const [errors, setErrors] = useState({})

  const load = () => client.get('/platform/faculty').then((res) => setFaculty(res.data.faculty || []))
  useAutoRefresh(load, [])

  const rows = useMemo(() => [...faculty].sort((a, b) => {
    if (sort === 'status') return a.status.localeCompare(b.status) || a.name.localeCompare(b.name)
    if (sort === 'email') return a.email.localeCompare(b.email)
    return a.name.localeCompare(b.name)
  }), [faculty, sort])

  const save = async (member, status) => {
    setErrors((current) => ({ ...current, [member.id]: '' }))
    try {
      await client.patch(`/platform/faculty/${member.id}`, { status })
      load()
    } catch (err) {
      setErrors((current) => ({
        ...current,
        [member.id]: err.response?.data?.message || 'Unable to update this faculty account.',
      }))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Faculty" description="Active faculty can sign in. Inactive faculty cannot." />
      <div className="form-field max-w-xs">
        <label htmlFor="platform-faculty-sort">Sort</label>
        <select id="platform-faculty-sort" value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border px-3 py-2">
          <option value="name">Name</option>
          <option value="email">Email</option>
          <option value="status">Login status</option>
        </select>
      </div>
      <ul className="space-y-3">
        {rows.map((member) => (
          <li key={member.id} className="card-gold-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-[#491464]">{member.name}</p>
                <p className="text-sm text-[#5c297c]">{member.email}</p>
                <p className="text-sm text-[#5c297c]">{member.department || 'No department'} · {member.is_online ? 'Online' : 'Offline'}</p>
              </div>
              <select
                value={member.status}
                onChange={(e) => save(member, e.target.value)}
                className="rounded-lg border px-3 py-2"
                aria-label={`Login status for ${member.name}`}
              >
                <option value="active">Active — can sign in</option>
                <option value="inactive">Inactive — cannot sign in</option>
              </select>
            </div>
            {errors[member.id] && <p className="form-field__error mt-2">{errors[member.id]}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
