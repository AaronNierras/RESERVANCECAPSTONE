import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import '../../styles/faculty-activities.css'

function formatStatus(status) {
  if (!status) return '—'
  return status.replace(/_/g, ' ')
}

function formatType(type) {
  if (!type) return '—'
  return type.replace(/_/g, ' ')
}

export default function FacultyActivitiesPage() {
  const navigate = useNavigate()
  const [activities, setActivities] = useState([])
  const [copyingId, setCopyingId] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const load = () => client.get('/super-admin/faculty-activities').then((res) => setActivities(res.data.activities))
  useAutoRefresh(load, [])

  const handleCopy = async (activity) => {
    setCopyingId(activity.id)
    setNotice('')
    setError('')

    try {
      const res = await client.post(`/super-admin/faculty-activities/${activity.id}/copy`)
      setNotice(res.data.message || 'Assessment copied to your drafts.')
      navigate(`/program-chair/activities-factory?draft=${res.data.activity.id}`)
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to copy this assessment right now.')
    } finally {
      setCopyingId(null)
    }
  }

  return (
    <div className="faculty-activities-page">
      <PageHeader
        title="Faculty Activities"
        description="Browse assessments created by faculty. Copy any assessment into your own Activity Factory draft to review or customize it without changing the original."
      />

      {notice && (
        <p className="faculty-activities-notice faculty-activities-notice--success" role="status">
          {notice}
        </p>
      )}

      {error && (
        <p className="faculty-activities-notice faculty-activities-notice--error" role="alert">
          {error}
        </p>
      )}

      <section className="faculty-activities-panel card-gold-border">
        <div className="faculty-activities-panel__head">
          <h2 className="faculty-activities-panel__title">Faculty assessment library</h2>
          <p className="faculty-activities-panel__meta">
            {activities.length} assessment{activities.length === 1 ? '' : 's'} from faculty
          </p>
        </div>

        {activities.length === 0 ? (
          <p className="faculty-activities-empty">No faculty assessments yet.</p>
        ) : (
          <div className="faculty-activities-table-wrap">
            <table className="faculty-activities-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Faculty</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Completion</th>
                  <th>Avg score</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity) => (
                  <tr key={activity.id}>
                    <td className="faculty-activities-table__title">{activity.title}</td>
                    <td>{activity.creator?.name || '—'}</td>
                    <td className="capitalize">{formatType(activity.type)}</td>
                    <td>
                      <span className={`faculty-activities-status faculty-activities-status--${activity.status}`}>
                        {formatStatus(activity.status)}
                      </span>
                    </td>
                    <td>{activity.completion_rate}%</td>
                    <td>{activity.average_score}%</td>
                    <td>
                      <button
                        type="button"
                        className="faculty-activities-copy-btn"
                        disabled={copyingId === activity.id}
                        onClick={() => handleCopy(activity)}
                      >
                        {copyingId === activity.id ? 'Copying…' : 'Copy to my assessments'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
