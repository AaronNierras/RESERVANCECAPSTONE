import { useMemo, useState } from 'react'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

export default function PlatformStudentsPage() {
  const [programs, setPrograms] = useState([])
  const [unassigned, setUnassigned] = useState([])
  const [sections, setSections] = useState([])
  const [drafts, setDrafts] = useState({})
  const [errors, setErrors] = useState({})
  const [sort, setSort] = useState('name')

  const load = () => {
    client.get('/platform/students').then((res) => {
      setPrograms(res.data.programs || [])
      setUnassigned(res.data.unassigned || [])
      setSections(res.data.section_choices || [])
    })
  }

  useAutoRefresh(load, [])

  const sortRows = (rows) => [...rows].sort((a, b) => {
    if (sort === 'status') return a.status.localeCompare(b.status) || a.name.localeCompare(b.name)
    if (sort === 'section') return String(a.section_label || '').localeCompare(String(b.section_label || '')) || a.name.localeCompare(b.name)
    return a.name.localeCompare(b.name)
  })

  const groups = useMemo(() => {
    const placed = programs.map((program) => ({
      ...program,
      sections: program.sections.map((section) => ({ ...section, students: sortRows(section.students || []) })),
    }))
    return { placed, unassigned: sortRows(unassigned) }
  }, [programs, unassigned, sort])

  const draftFor = (student) => drafts[student.id] || {
    section_id: student.section_id ? String(student.section_id) : '',
    status: student.status,
  }

  const save = async (student) => {
    const draft = draftFor(student)
    setErrors((current) => ({ ...current, [student.id]: '' }))
    try {
      await client.patch(`/platform/students/${student.id}`, {
        section_id: draft.section_id ? Number(draft.section_id) : null,
        status: draft.status,
      })
      load()
    } catch (err) {
      const message = err.response?.data?.errors?.status?.[0]
        || err.response?.data?.errors?.section_id?.[0]
        || err.response?.data?.message
        || 'Unable to update this student.'
      setErrors((current) => ({ ...current, [student.id]: message }))
    }
  }

  const renderStudent = (student) => {
    const draft = draftFor(student)
    return (
      <li key={student.id} className="rounded-lg border border-[#5c297c]/12 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-bold text-[#491464]">{student.name}</p>
            <p className="text-sm text-[#5c297c]">{student.email} · {student.student_number || 'No student number'}</p>
            <p className="text-sm text-[#5c297c]">{student.section_label || 'No section'} · {student.year_level_label || 'Year follows the section'}</p>
          </div>
          <span className="text-sm font-semibold text-[#491464]">{student.is_online ? 'Online' : 'Offline'}</span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_10rem_auto]">
          <select
            value={draft.section_id}
            onChange={(e) => setDrafts((current) => ({ ...current, [student.id]: { ...draft, section_id: e.target.value } }))}
            className="rounded-lg border px-3 py-2"
            aria-label={`Section for ${student.name}`}
          >
            <option value="">Select section</option>
            {sections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}
          </select>
          <select
            value={draft.status}
            onChange={(e) => setDrafts((current) => ({ ...current, [student.id]: { ...draft, status: e.target.value } }))}
            className="rounded-lg border px-3 py-2"
            aria-label={`Login status for ${student.name}`}
          >
            <option value="active">Active — can sign in</option>
            <option value="inactive">Inactive — cannot sign in</option>
          </select>
          <button type="button" className="rounded-lg bg-[#ffb736] px-4 py-2 text-sm font-bold text-[#491464]" onClick={() => save(student)}>
            Save
          </button>
        </div>
        {errors[student.id] && <p className="form-field__error mt-2">{errors[student.id]}</p>}
      </li>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Students" description="Sections are grouped by course. Year level follows the section. Active accounts can sign in." />
      <div className="form-field max-w-xs">
        <label htmlFor="platform-student-sort">Sort</label>
        <select id="platform-student-sort" value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border px-3 py-2">
          <option value="name">Name</option>
          <option value="section">Section</option>
          <option value="status">Login status</option>
        </select>
      </div>
      {groups.placed.map((program) => (
        <section key={program.id} className="card-gold-border p-4">
          <h2 className="text-lg font-bold text-[#491464]">{program.name}</h2>
          {program.sections.map((section) => (
            <div key={section.id} className="mt-4">
              <h3 className="font-semibold text-[#5c297c]">{section.label}</h3>
              {section.students.length === 0 ? (
                <p className="mt-2 text-sm text-[#5c297c]">No students in this section.</p>
              ) : (
                <ul className="mt-2 space-y-3">{section.students.map(renderStudent)}</ul>
              )}
            </div>
          ))}
        </section>
      ))}
      <section className="card-gold-border p-4">
        <h2 className="text-lg font-bold text-[#491464]">Waiting for a section</h2>
        {groups.unassigned.length === 0 ? (
          <p className="mt-2 text-sm text-[#5c297c]">Every student has a section.</p>
        ) : (
          <ul className="mt-3 space-y-3">{groups.unassigned.map(renderStudent)}</ul>
        )}
      </section>
    </div>
  )
}
