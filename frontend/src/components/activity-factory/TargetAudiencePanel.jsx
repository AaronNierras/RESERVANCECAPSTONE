import { formatSectionLabel } from '../../utils/activityFactory'

export default function TargetAudiencePanel({
  targeting,
  programs,
  students,
  errors = [],
  onChange,
}) {
  const allSections = programs.flatMap((p) => (p.sections || []).map((s) => ({ ...s, program: p })))

  const setMode = (mode) => onChange({ ...targeting, mode })

  const toggleSection = (id) => {
    const sectionIds = targeting.sectionIds.includes(id)
      ? targeting.sectionIds.filter((x) => x !== id)
      : [...targeting.sectionIds, id]
    onChange({ ...targeting, sectionIds })
  }

  const toggleStudent = (id) => {
    const studentIds = targeting.studentIds.includes(id)
      ? targeting.studentIds.filter((x) => x !== id)
      : [...targeting.studentIds, id]
    onChange({ ...targeting, studentIds })
  }

  return (
    <div>
      <div className="af-target-cards">
        {[
          { id: 'all', title: 'All sections', desc: 'Available to every section in the system.' },
          { id: 'sections', title: 'Specific section(s)', desc: 'Choose one or more sections from the masterlist.' },
          { id: 'students', title: 'Specific student(s)', desc: 'Target individual students only.' },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`af-target-card ${targeting.mode === opt.id ? 'is-active' : ''}`}
            onClick={() => setMode(opt.id)}
          >
            <h3 className="af-card__title">{opt.title}</h3>
            <p className="af-card__meta">{opt.desc}</p>
          </button>
        ))}
      </div>

      {targeting.mode === 'sections' && (
        <div>
          <div className="af-card__actions">
            <button type="button" className="af-btn af-btn--ghost" onClick={() => onChange({ ...targeting, sectionIds: allSections.map((s) => s.id) })}>Select all</button>
            <button type="button" className="af-btn af-btn--ghost" onClick={() => onChange({ ...targeting, sectionIds: [] })}>Clear all</button>
          </div>
          <div className="af-section-list">
            {allSections.map((section) => (
              <label key={section.id} className="af-check-row">
                <input
                  type="checkbox"
                  checked={targeting.sectionIds.includes(section.id)}
                  onChange={() => toggleSection(section.id)}
                />
                <span>{formatSectionLabel(section, section.program)}</span>
              </label>
            ))}
            {!allSections.length && <div className="af-empty">No sections available.</div>}
          </div>
        </div>
      )}

      {targeting.mode === 'students' && (
        <div className="af-section-list">
          {students.map((student) => (
            <label key={student.id} className="af-check-row">
              <input
                type="checkbox"
                checked={targeting.studentIds.includes(student.id)}
                onChange={() => toggleStudent(student.id)}
              />
              <span>
                {student.name}
                {student.student_profile?.student_number ? ` · ${student.student_profile.student_number}` : ''}
              </span>
            </label>
          ))}
          {!students.length && <div className="af-empty">No students available.</div>}
        </div>
      )}

      {errors.length > 0 && (
        <ul className="af-error" style={{ marginTop: '1rem', paddingLeft: '1.1rem' }}>
          {errors.map((err) => <li key={err}>{err}</li>)}
        </ul>
      )}
    </div>
  )
}
