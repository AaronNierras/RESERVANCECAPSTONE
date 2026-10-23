import { useMemo, useState } from 'react'
import client from '../../api/client'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { emptyMarks, evaluateLabMarks, ratingLabel } from '../../utils/labRubric'
import '../../styles/lab-rubric.css'

const TABS = [
  ['record', 'Score sheet'],
  ['rubric', 'Official rubric'],
  ['prep', 'Laboratory preparation'],
]

function errorText(error) {
  const errors = error?.response?.data?.errors
  if (errors) return Object.values(errors).flat().join(' ')
  return 'The score could not be saved.'
}

function pointsText(earned, points) {
  if (earned === null || earned === undefined) return '—'
  return `${earned}/${points}`
}

export default function LabRubricPanel() {
  const [payload, setPayload] = useState(null)
  const [tab, setTab] = useState('record')
  const [sectionId, setSectionId] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [marks, setMarks] = useState({})
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')

  const load = () => client.get('/lab-rubric')
    .then((res) => {
      setPayload(res.data)
      setLoadError('')
    })
    .catch(() => setLoadError('The laboratory rubric could not be loaded.'))

  useAutoRefresh(load, [])

  const rubric = payload?.rubric
  const canScore = Boolean(payload?.can_score)
  const students = payload?.students || []
  const visibleStudents = students.filter((student) => sectionId === 'all' || String(student.section_id || 'none') === sectionId)
  const selected = students.find((student) => student.id === selectedId) || null
  const preview = useMemo(
    () => (rubric && selected ? evaluateLabMarks(rubric, marks) : null),
    [rubric, selected, marks],
  )
  const ownResult = payload?.record?.result || null

  function openStudent(student) {
    setSelectedId(student.id)
    setMarks(emptyMarks(rubric, student.record))
    setFeedback(student.record?.feedback || '')
    setError('')
    setTab('record')
  }

  function setCriterion(activityKey, criterionKey, value) {
    setMarks((current) => ({
      ...current,
      [activityKey]: { ...current[activityKey], [criterionKey]: value },
    }))
  }

  function quickMark(activity, criterionKey, mode) {
    const max = activity.criteria[criterionKey]
    const value = mode === 'full' ? max : mode === 'partial' ? Math.round(max / 2) : 0
    setCriterion(activity.key, criterionKey, value)
  }

  async function saveScore() {
    if (!selected) return
    setSaving(true)
    setError('')
    try {
      const res = await client.put(`/lab-rubric/students/${selected.id}`, {
        marks,
        feedback,
      })
      setPayload((current) => ({
        ...current,
        students: current.students.map((student) => (
          student.id === selected.id ? { ...student, record: res.data.record } : student
        )),
      }))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="lab-page">
      {loadError && <p className="lab-error">{loadError}</p>}

      {rubric && (
        <p className="lab-callout">{rubric.passing_note}</p>
      )}

      <div className="lab-tabs no-print" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {id === 'record' && !canScore ? 'My result' : label}
          </button>
        ))}
      </div>

      {tab === 'record' && canScore && rubric && (
        <>
          <div className="lab-toolbar no-print">
            <label>
              Section
              <select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
                <option value="all">All sections</option>
                <option value="none">No section</option>
                {(payload.sections || []).map((section) => (
                  <option key={section.id} value={String(section.id)}>{section.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="card-gold-border lab-table-wrap">
            <table className="lab-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Section</th>
                  {rubric.activities.map((activity) => <th key={activity.key}>{activity.short.replace(/^\d+\.\s*/, '')}</th>)}
                  <th>Total</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map((student) => {
                  const result = student.record?.result
                  return (
                    <tr key={student.id} data-selected={student.id === selectedId}>
                      <td>
                        <button type="button" className="linkish" onClick={() => openStudent(student)}>{student.name}</button>
                        <div>{student.student_number || student.email}</div>
                      </td>
                      <td>{student.section_label}</td>
                      {rubric.activities.map((activity) => {
                        const row = result?.activities?.find((item) => item.key === activity.key)
                        return <td key={activity.key}>{pointsText(row?.earned, activity.points)}</td>
                      })}
                      <td>{pointsText(result?.earned, 100)}</td>
                      <td><span className="lab-chip" data-rating={result?.rating || 'not_scored'}>{ratingLabel(result?.rating)}</span></td>
                    </tr>
                  )
                })}
                {visibleStudents.length === 0 && (
                  <tr><td colSpan={rubric.activities.length + 4}>No students in this section.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {selected && preview && (
            <ScoreSheet
              rubric={rubric}
              title={selected.name}
              subtitle={`${selected.section_label}${selected.student_number ? ` · ${selected.student_number}` : ''}`}
              marks={marks}
              preview={preview}
              feedback={feedback}
              canEdit
              saving={saving}
              error={error}
              onCriterion={setCriterion}
              onQuick={quickMark}
              onNote={(key, note) => setCriterion(key, 'note', note)}
              onFeedback={setFeedback}
              onSave={saveScore}
            />
          )}
        </>
      )}

      {tab === 'record' && !canScore && rubric && (
        payload.record ? (
          <ScoreSheet
            rubric={rubric}
            title="Your laboratory result"
            subtitle={payload.record.assessor?.name ? `Scored by ${payload.record.assessor.name}` : 'Recorded result'}
            marks={emptyMarks(rubric, payload.record)}
            preview={ownResult}
            feedback={payload.record.feedback || ''}
            canEdit={false}
          />
        ) : (
          <div className="card-gold-border lab-score">
            <p className="lab-callout">Your laboratory result is not recorded yet. Review the official rubric and the outputs you need to submit.</p>
          </div>
        )
      )}

      {tab === 'rubric' && rubric && <OfficialRubric rubric={rubric} />}
      {tab === 'prep' && rubric && <Preparation phases={rubric.preparation} />}
    </div>
  )
}

function ScoreSheet({
  rubric, title, subtitle, marks, preview, feedback, canEdit, saving, error,
  onCriterion, onQuick, onNote, onFeedback, onSave,
}) {
  const failed = preview.activities.filter((activity) => activity.rating === 'not_yet_competent')
  return (
    <section className="card-gold-border lab-score">
      <div className="lab-score-head">
        <div>
          <h2>{title}</h2>
          <p className="lab-callout">{subtitle}</p>
          {preview.rating === 'not_yet_competent' && (
            <p className="lab-callout">Not Yet Competent on {failed.map((activity) => rubric.activities.find((item) => item.key === activity.key)?.short).filter(Boolean).join(', ')}. Repeat those activities with a different scenario.</p>
          )}
          {preview.rating === 'in_progress' && canEdit && (
            <p className="lab-callout">Enter all four criteria on every activity to record Competent or Not Yet Competent.</p>
          )}
        </div>
        <div className="lab-total">
          <strong>{preview.earned === null ? '—' : `${preview.earned}/100`}</strong>
          <span className="lab-chip" data-rating={preview.rating}>{ratingLabel(preview.rating)}</span>
        </div>
      </div>

          {rubric.activities.map((activity) => {
        const row = preview.activities.find((item) => item.key === activity.key)
        return (
          <ActivityBlock key={activity.key} openFirst={activity.key === 'reservations'}>
            <summary>
              <span>{activity.title}</span>
              <span className="lab-chip" data-rating={row.rating}>{pointsText(row.earned, activity.points)} · {ratingLabel(row.rating)}</span>
            </summary>
            <div className="lab-activity-body">
              <p className="lab-callout">{activity.outcome}</p>
              <div className="lab-meta">
                <span>{activity.method}</span>
                <span>{activity.output}</span>
                <span>{activity.hours} hours · {Math.round(activity.weight * 100)}%</span>
                <span>Passes at {row.passing_points} of {activity.points}</span>
              </div>
              <div className="lab-criteria">
                {rubric.criteria.map((criterion) => (
                  <label key={criterion.key} className="lab-criterion">
                    <strong>{criterion.label}</strong>
                    <small>0 to {activity.criteria[criterion.key]} points</small>
                    <input
                      type="number"
                      min="0"
                      max={activity.criteria[criterion.key]}
                      step="1"
                      disabled={!canEdit}
                      value={marks[activity.key]?.[criterion.key] ?? ''}
                      onChange={(event) => onCriterion(activity.key, criterion.key, event.target.value)}
                    />
                    {canEdit && (
                      <span className="lab-quick">
                        <button type="button" onClick={() => onQuick(activity, criterion.key, 'full')}>Followed</button>
                        <button type="button" onClick={() => onQuick(activity, criterion.key, 'partial')}>Partial</button>
                        <button type="button" onClick={() => onQuick(activity, criterion.key, 'missed')}>Missed</button>
                      </span>
                    )}
                  </label>
                ))}
              </div>
              <label>
                Observation note
                <textarea
                  className="lab-note"
                  disabled={!canEdit}
                  value={marks[activity.key]?.note || ''}
                  onChange={(event) => onNote(activity.key, event.target.value)}
                />
              </label>
            </div>
          </ActivityBlock>
        )
      })}

      <label>
        Feedback for the student
        <textarea className="lab-note" disabled={!canEdit} value={feedback} onChange={(event) => onFeedback(event.target.value)} />
      </label>
      {error && <p className="lab-error">{error}</p>}
      {canEdit && <button type="button" className="lab-save" disabled={saving} onClick={onSave}>{saving ? 'Saving…' : 'Save laboratory score'}</button>}
    </section>
  )
}

function ActivityBlock({ openFirst, children, className = '' }) {
  const [open, setOpen] = useState(openFirst)
  return (
    <details className={`lab-activity ${className}`.trim()} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      {children}
    </details>
  )
}

function OfficialRubric({ rubric }) {
  return (
    <div className="lab-definition">
      <div className="card-gold-border lab-table-wrap">
        <table className="lab-table">
          <thead>
            <tr>
              <th>Lab activity</th>
              <th>Learning outcome</th>
              <th>Hours</th>
              <th>Weight</th>
              <th>Points</th>
              <th>Assessment method</th>
              <th>Required output</th>
            </tr>
          </thead>
          <tbody>
            {rubric.activities.map((activity) => (
              <tr key={activity.key}>
                <td>{activity.title}</td>
                <td>{activity.outcome}</td>
                <td>{activity.hours}</td>
                <td>{Math.round(activity.weight * 100)}%</td>
                <td>{activity.points}</td>
                <td>{activity.method}</td>
                <td>{activity.output}</td>
              </tr>
            ))}
            <tr>
              <td>TOTAL</td>
              <td />
              <td>40</td>
              <td>100%</td>
              <td>100</td>
              <td />
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card-gold-border lab-table-wrap">
        <table className="lab-table">
          <thead>
            <tr>
              <th>Lab activity</th>
              {rubric.criteria.map((criterion) => (
                <th key={criterion.key}>{criterion.label} ({criterion.share}%)</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rubric.activities.map((activity) => (
              <tr key={activity.key}>
                <td>{activity.short}</td>
                {rubric.criteria.map((criterion) => <td key={criterion.key}>{activity.criteria[criterion.key]}</td>)}
                <td>{activity.points}</td>
              </tr>
            ))}
            <tr>
              <td>TOTAL</td>
              {rubric.criteria.map((criterion) => (
                <td key={criterion.key}>{rubric.activities.reduce((sum, activity) => sum + activity.criteria[criterion.key], 0)}</td>
              ))}
              <td>100</td>
            </tr>
          </tbody>
        </table>
      </div>

      {rubric.criteria.map((criterion) => (
        <p key={criterion.key} className="lab-callout"><strong>{criterion.label}.</strong> {criterion.description}</p>
      ))}
    </div>
  )
}

function Preparation({ phases }) {
  return (
    <div className="lab-prep">
      {phases.map((phase, index) => (
        <ActivityBlock key={phase.title} className="card-gold-border" openFirst={index === 0}>
          <summary>{phase.title}</summary>
          <div className="lab-activity-body">
            {phase.steps.map((step) => (
              <p key={step.title} className="lab-callout"><strong>{step.title}</strong> {step.body}</p>
            ))}
          </div>
        </ActivityBlock>
      ))}
    </div>
  )
}
