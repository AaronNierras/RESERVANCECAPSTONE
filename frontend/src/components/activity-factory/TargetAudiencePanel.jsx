import { useMemo, useState } from 'react'
import { formatSectionLabel } from '../../utils/activityFactory'

function profileOf(student) {
  return student?.student_profile || student?.studentProfile || null
}

function sectionIdOf(student) {
  const profile = profileOf(student)
  return profile?.section?.id || profile?.section_id || null
}

export function isEligibleStudent(student) {
  const profile = profileOf(student)
  if (!sectionIdOf(student)) return false
  if (student.status && student.status !== 'active') return false
  if (profile?.academic_status && profile.academic_status !== 'active') return false
  return true
}

export function eligibleStudents(students) {
  return (students || []).filter(isEligibleStudent)
}

export default function TargetAudiencePanel({
  targeting,
  programs,
  students,
  errors = [],
  onChange,
}) {
  const [sectionQuery, setSectionQuery] = useState('')
  const [studentQuery, setStudentQuery] = useState('')
  const roster = useMemo(() => eligibleStudents(students), [students])
  const allSections = programs.flatMap((program) => (program.sections || []).map((section) => ({ ...section, program })))

  const countFor = (sectionId) => roster.filter((student) => String(sectionIdOf(student)) === String(sectionId)).length

  const selectedSections = allSections.filter((section) => targeting.sectionIds.map(String).includes(String(section.id)))
  const selectedStudents = roster.filter((student) => targeting.studentIds.map(String).includes(String(student.id)))

  const sectionText = sectionQuery.trim().toLowerCase()
  const visibleSections = allSections.filter((section) => {
    if (!sectionText) return true
    const period = section.program?.current_period?.school_year || ''
    return `${section.program?.name || ''} ${formatSectionLabel(section, section.program)} ${section.semester || ''} ${period}`.toLowerCase().includes(sectionText)
  })

  const studentText = studentQuery.trim().toLowerCase()
  const visibleStudents = roster.filter((student) => {
    if (!studentText) return true
    const profile = profileOf(student)
    return [
      student.name,
      profile?.student_number,
      profile?.program?.name,
      profile?.section?.display_label,
      profile?.section?.name,
    ].some((value) => String(value || '').toLowerCase().includes(studentText))
  })

  const summary = targeting.mode === 'all'
    ? `${allSections.length} section${allSections.length === 1 ? '' : 's'} · ${roster.length} eligible student${roster.length === 1 ? '' : 's'} in BS Hospitality Management and BS Tourism Management`
    : targeting.mode === 'sections'
      ? `${selectedSections.length} section${selectedSections.length === 1 ? '' : 's'} · ${selectedSections.reduce((sum, section) => sum + countFor(section.id), 0)} eligible students`
      : `${selectedStudents.length} selected student${selectedStudents.length === 1 ? '' : 's'}`

  const setMode = (mode) => onChange({ ...targeting, mode })

  const toggleSection = (id) => {
    const current = targeting.sectionIds.map(String)
    const sectionIds = current.includes(String(id))
      ? targeting.sectionIds.filter((item) => String(item) !== String(id))
      : [...targeting.sectionIds, id]
    onChange({ ...targeting, sectionIds })
  }

  const toggleStudent = (id) => {
    const current = targeting.studentIds.map(String)
    const studentIds = current.includes(String(id))
      ? targeting.studentIds.filter((item) => String(item) !== String(id))
      : [...targeting.studentIds, id]
    onChange({ ...targeting, studentIds })
  }

  return (
    <div className="af-audience">
      <div className="af-target-cards">
        {[
          { id: 'all', title: 'All sections', desc: 'Every section in your official programs. This does not include students outside BSHM and BSTM.' },
          { id: 'sections', title: 'Specific section(s)', desc: 'Choose one or more sections. Each row shows the course, section, and eligible students.' },
          { id: 'students', title: 'Specific student(s)', desc: 'Search and choose students across the sections you can assign.' },
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

      {targeting.mode === 'all' && (
        <p className="af-audience__count">{allSections.length} sections · {roster.length} eligible students</p>
      )}

      {targeting.mode === 'sections' && (
        <div>
          <div className="af-audience__tools">
            <input className="af-input" value={sectionQuery} onChange={(event) => setSectionQuery(event.target.value)} placeholder="Search course or section" />
            <button type="button" className="af-btn af-btn--ghost" onClick={() => onChange({ ...targeting, sectionIds: allSections.map((section) => section.id) })}>Select all</button>
            <button type="button" className="af-btn af-btn--ghost" onClick={() => onChange({ ...targeting, sectionIds: [] })}>Clear</button>
          </div>
          <div className="af-section-list">
            {visibleSections.map((section) => (
              <label key={section.id} className="af-check-row">
                <input
                  type="checkbox"
                  checked={targeting.sectionIds.map(String).includes(String(section.id))}
                  onChange={() => toggleSection(section.id)}
                />
                <span>
                  <strong>{section.program?.name}</strong>
                  {' · '}
                  {formatSectionLabel(section, section.program)}
                  {' · '}
                  {countFor(section.id)} eligible
                </span>
              </label>
            ))}
            {!visibleSections.length && <div className="af-empty">No sections match that search.</div>}
          </div>
        </div>
      )}

      {targeting.mode === 'students' && (
        <div>
          <div className="af-audience__tools">
            <input className="af-input" value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Search name, student number, course, or section" />
          </div>
          <div className="af-section-list">
            {visibleStudents.map((student) => {
              const profile = profileOf(student)
              return (
                <label key={student.id} className="af-check-row">
                  <input
                    type="checkbox"
                    checked={targeting.studentIds.map(String).includes(String(student.id))}
                    onChange={() => toggleStudent(student.id)}
                  />
                  <span>
                    <strong>{student.name}</strong>
                    {' · '}
                    {profile?.student_number || 'No student number'}
                    {' · '}
                    {profile?.program?.name || 'No course'}
                    {' · '}
                    {profile?.section?.display_label || profile?.section?.name || 'No section'}
                  </span>
                </label>
              )
            })}
            {!visibleStudents.length && <div className="af-empty">No eligible students match that search.</div>}
          </div>
        </div>
      )}

      <p className="af-audience__summary">Audience: {summary}</p>
      {errors.map((error) => <p key={error} className="af-error">{error}</p>)}
    </div>
  )
}
