import { useEffect, useState } from 'react'
import client from '../../api/client'

export default function SimulationRubricGrade({ activity, onClose }) {
  const [payload, setPayload] = useState(null)
  const [marks, setMarks] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [savingId, setSavingId] = useState(null)

  useEffect(() => {
    let active = true
    client.get(`/activities/${activity.id}/outputs`)
      .then((res) => {
        if (!active) return
        setPayload(res.data)
        const next = {}
        ;(res.data.attempts || []).forEach((attempt) => {
          next[attempt.id] = attempt.laboratory
            ? Object.fromEntries((attempt.laboratory.activities || []).map((task) => [task.key, {
              process: task.criteria?.find((item) => item.key === 'process')?.earned ?? '',
              accuracy: task.criteria?.find((item) => item.key === 'accuracy')?.earned ?? '',
              communication: task.criteria?.find((item) => item.key === 'communication')?.earned ?? '',
              professionalism: task.criteria?.find((item) => item.key === 'professionalism')?.earned ?? '',
              note: task.note || '',
            }]))
            : attempt.suggested
        })
        setMarks(next)
      })
      .catch(() => {
        if (active) setError('The rubric could not be loaded.')
      })
    return () => { active = false }
  }, [activity.id])

  const updateMark = (attemptId, taskKey, field, value) => {
    setMarks((current) => ({
      ...current,
      [attemptId]: {
        ...(current[attemptId] || {}),
        [taskKey]: {
          ...(current[attemptId]?.[taskKey] || {}),
          [field]: value,
        },
      },
    }))
  }

  const save = async (attemptId) => {
    setSavingId(attemptId)
    setError('')
    setNotice('')
    try {
      const res = await client.put(`/activities/${activity.id}/attempts/${attemptId}/lab-rubric`, {
        marks: marks[attemptId],
      })
      setNotice(`${res.data.laboratory.rating === 'competent' ? 'Competent' : 'Not yet competent'} · ${res.data.laboratory.percentage}%`)
    } catch (err) {
      const message = err.response?.data?.errors?.marks?.[0]
        || err.response?.data?.message
        || 'The rubric could not be saved.'
      setError(message)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="modal-root" role="presentation" onClick={onClose}>
      <div className="modal-panel modal-panel--xl" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="modal-panel__head">
          <h2 className="modal-panel__title">Grade scenario output · {activity.title}</h2>
          <button type="button" className="modal-panel__close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="modal-panel__body">
          {error && <p className="af-error">{error}</p>}
          {notice && <p className="af-audience__summary">{notice}</p>}
          {!payload && !error && <p>Loading submitted outputs…</p>}
          {payload && (
            <>
              <p className="af-section-sub">{payload.rubric.note}</p>
              {!payload.attempts.length && <p className="af-empty">No submitted outputs yet.</p>}
              {payload.attempts.map((attempt) => (
                <article key={attempt.id} className="af-rubric-card">
                  <h3>{attempt.student?.name}</h3>
                  <p>{attempt.student?.student_number || 'No student number'} · {attempt.student?.section || 'No section'}</p>
                  {payload.rubric.tasks.map((task) => (
                    <div key={task.key} className="af-rubric-task">
                      <h4>{task.short} · {task.points} points</h4>
                      <p>{task.outcome}</p>
                      {(() => {
                        const row = (attempt.system || []).find((item) => item.key === task.key)
                        if (!row || row.tries_used == null) return null
                        return <p>Wrong tries: {row.tries_used}. Deduction on the system score: {row.deduction}.</p>
                      })()}
                      <div className="af-form-grid af-form-grid--2">
                        {payload.rubric.criteria.map((criterion) => (
                          <label key={criterion.key} className="af-field">
                            <span>{criterion.label} (0–{task.criteria[criterion.key]})</span>
                            <input
                              className="af-input"
                              type="number"
                              min="0"
                              max={task.criteria[criterion.key]}
                              value={marks[attempt.id]?.[task.key]?.[criterion.key] ?? ''}
                              onChange={(event) => updateMark(attempt.id, task.key, criterion.key, event.target.value)}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button type="button" className="af-btn af-btn--gold" onClick={() => save(attempt.id)} disabled={savingId === attempt.id}>
                    {savingId === attempt.id ? 'Saving…' : 'Save rubric grade'}
                  </button>
                </article>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
