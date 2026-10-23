import { useState } from 'react'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { formatSectionLabel } from '../../utils/academic'

export default function RegistrationGatePage() {
  const [registrations, setRegistrations] = useState([])
  const [programs, setPrograms] = useState([])
  const [choices, setChoices] = useState({})
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')

  const load = () => client.get('/super-admin/registrations').then((res) => {
    setRegistrations(res.data.registrations || [])
    setPrograms(res.data.programs || [])
  })
  useAutoRefresh(load, [])

  const sectionsFor = (programId) => {
    const program = programs.find((item) => String(item.id) === String(programId))
    return (program?.sections || []).map((section) => ({
      id: section.id,
      label: formatSectionLabel(program.code || program.name, section.year_level, section.name, section.semester),
    }))
  }

  const accept = async (student) => {
    const choice = choices[student.id] || {}
    if (!choice.section_id) {
      setErrors((current) => ({ ...current, [student.id]: 'Choose a course and section before accepting.' }))
      return
    }
    setErrors((current) => ({ ...current, [student.id]: '' }))
    try {
      await client.post(`/super-admin/registrations/${student.id}/accept`, {
        section_id: Number(choice.section_id),
      })
      setNotice(`${student.name} can now sign in.`)
      load()
    } catch (err) {
      setErrors((current) => ({
        ...current,
        [student.id]: err.response?.data?.errors?.section_id?.[0] || err.response?.data?.message || 'Unable to accept this registration.',
      }))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registration gate"
        description="Students who register themselves stay signed out until you assign a course section and accept them."
      />
      {notice && <p className="rounded-lg bg-[#f3edf7] px-4 py-3 text-sm font-semibold text-[#491464]">{notice}</p>}
      {registrations.length === 0 ? (
        <p className="registry-empty">No students are waiting.</p>
      ) : (
        <ul className="space-y-4">
          {registrations.map((student) => {
            const choice = choices[student.id] || { program_id: '', section_id: '' }
            return (
              <li key={student.id} className="card-gold-border p-4">
                <p className="font-bold text-[#491464]">{student.name}</p>
                <p className="text-sm text-[#5c297c]">{student.email} · {student.student_number}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <select
                    value={choice.program_id}
                    onChange={(e) => setChoices((current) => ({ ...current, [student.id]: { program_id: e.target.value, section_id: '' } }))}
                    className="rounded-lg border px-3 py-2"
                    aria-label={`Course for ${student.name}`}
                  >
                    <option value="">Select course</option>
                    {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
                  </select>
                  <select
                    value={choice.section_id}
                    onChange={(e) => setChoices((current) => ({ ...current, [student.id]: { ...choice, section_id: e.target.value } }))}
                    className="rounded-lg border px-3 py-2"
                    aria-label={`Section for ${student.name}`}
                  >
                    <option value="">Select section</option>
                    {sectionsFor(choice.program_id).map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}
                  </select>
                  <button type="button" className="rounded-lg bg-[#ffb736] px-4 py-2 font-bold text-[#491464]" onClick={() => accept(student)}>
                    Accept
                  </button>
                </div>
                {errors[student.id] && <p className="form-field__error mt-2">{errors[student.id]}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
