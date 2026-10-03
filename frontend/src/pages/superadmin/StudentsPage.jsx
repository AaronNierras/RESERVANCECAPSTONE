import { useEffect, useMemo, useState } from 'react'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { capitalizeName, formatSectionLabel, validateStudentForm } from '../../utils/academic'
import '../../styles/academic.css'

const MASTERLIST_PAGE_SIZE = 50

const emptyForm = () => ({
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  student_number: '',
  program_id: '',
  section_id: '',
})

function Field({ label, error, hint, children }) {
  return (
    <div className="form-field">
      <label>{label}</label>
      {children}
      {hint && <p className="form-field__hint">{hint}</p>}
      {error && <p className="form-field__error">{error}</p>}
    </div>
  )
}

export default function SuperAdminStudentsPage() {
  const [students, setStudents] = useState([])
  const [programs, setPrograms] = useState([])
  const [form, setForm] = useState(emptyForm())
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [masterlistProgramFilter, setMasterlistProgramFilter] = useState('')
  const [masterlistSectionFilter, setMasterlistSectionFilter] = useState('')
  const [masterlistPresenceFilter, setMasterlistPresenceFilter] = useState('')
  const [masterlistStatusFilter, setMasterlistStatusFilter] = useState('')
  const [masterlistSort, setMasterlistSort] = useState('name')
  const [masterlistPage, setMasterlistPage] = useState(1)
  const [masterlistSearch, setMasterlistSearch] = useState('')

  const load = () => {
    client.get('/super-admin/students').then((res) => setStudents(res.data.students))
    client.get('/super-admin/programs').then((res) => setPrograms(res.data.programs))
  }

  useAutoRefresh(load, [])

  const sections = programs.flatMap((p) => (p.sections || []).map((s) => ({ ...s, program_id: p.id, program_name: p.name })))
  const filteredSections = sections.filter((s) => String(s.program_id) === String(form.program_id))
  const masterlistSections = sections.filter((s) => !masterlistProgramFilter || String(s.program_id) === String(masterlistProgramFilter))

  const getSectionLabel = (student) => student.student_profile?.section?.display_label
    || (student.student_profile?.program?.name && student.student_profile?.section?.name
      ? formatSectionLabel(
        student.student_profile.program.name,
        student.student_profile.year_level,
        student.student_profile.section.name,
        student.student_profile.section.semester,
      )
      : '—')

  const filteredMasterlistStudents = useMemo(() => {
    const query = masterlistSearch.trim().toLowerCase()

    return students.filter((student) => {
      const profile = student.student_profile
      const programId = profile?.program?.id
      const sectionId = profile?.section?.id
      const academicStatus = String(profile?.academic_status || student.status || '').toLowerCase()

      if (masterlistProgramFilter && String(programId) !== String(masterlistProgramFilter)) {
        return false
      }
      if (masterlistSectionFilter && String(sectionId) !== String(masterlistSectionFilter)) {
        return false
      }
      if (masterlistPresenceFilter === 'online' && !student.is_online) {
        return false
      }
      if (masterlistPresenceFilter === 'offline' && student.is_online) {
        return false
      }
      if (masterlistStatusFilter && academicStatus !== masterlistStatusFilter) {
        return false
      }
      if (query) {
        const matchesSearch = [
          student.name,
          student.email,
          profile?.student_number,
          profile?.program?.name,
          getSectionLabel(student),
          profile?.first_name,
          profile?.last_name,
        ].some((value) => String(value || '').toLowerCase().includes(query))

        if (!matchesSearch) return false
      }
      return true
    })
  }, [students, masterlistProgramFilter, masterlistSectionFilter, masterlistPresenceFilter, masterlistStatusFilter, masterlistSearch])

  const sortedMasterlistStudents = useMemo(() => {
    const list = [...filteredMasterlistStudents]
    return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [filteredMasterlistStudents, masterlistSort])

  const masterlistTotalPages = Math.max(1, Math.ceil(sortedMasterlistStudents.length / MASTERLIST_PAGE_SIZE))

  const paginatedMasterlistStudents = useMemo(() => {
    const start = (masterlistPage - 1) * MASTERLIST_PAGE_SIZE
    return sortedMasterlistStudents.slice(start, start + MASTERLIST_PAGE_SIZE)
  }, [sortedMasterlistStudents, masterlistPage])

  const masterlistRangeStart = sortedMasterlistStudents.length === 0
    ? 0
    : (masterlistPage - 1) * MASTERLIST_PAGE_SIZE + 1
  const masterlistRangeEnd = sortedMasterlistStudents.length === 0
    ? 0
    : Math.min(masterlistPage * MASTERLIST_PAGE_SIZE, sortedMasterlistStudents.length)

  useEffect(() => {
    setMasterlistPage(1)
  }, [masterlistProgramFilter, masterlistSectionFilter, masterlistPresenceFilter, masterlistStatusFilter, masterlistSort, masterlistSearch])

  useEffect(() => {
    if (masterlistPage > masterlistTotalPages) {
      setMasterlistPage(masterlistTotalPages)
    }
  }, [masterlistPage, masterlistTotalPages])

  const updateField = (field, value) => {
    const nextValue = ['first_name', 'last_name'].includes(field) ? capitalizeName(value) : value
    setForm((prev) => ({ ...prev, [field]: nextValue }))
    setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const validation = validateStudentForm(form)
    setErrors(validation)
    if (Object.keys(validation).length) return

    setSubmitting(true)
    setSubmitError('')
    try {
      await client.post('/super-admin/students', {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        student_number: form.student_number,
        program_id: form.program_id,
        section_id: form.section_id,
      })
      setForm(emptyForm())
      load()
    } catch (err) {
      const apiErrors = err.response?.data?.errors
      if (apiErrors) {
        const mapped = Object.fromEntries(
          Object.entries(apiErrors).map(([key, messages]) => [key, messages[0]]),
        )
        setErrors(mapped)
      } else {
        setSubmitError(err.response?.data?.message || 'Unable to register student.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Student Registry" description="Register and manage students." />

      <form onSubmit={submit} className="card-gold-border grid gap-4 p-6 md:grid-cols-2">
        <h3 className="form-section-title">Personal Information</h3>

        <Field label="First Name" error={errors.first_name}>
          <input value={form.first_name} onChange={(e) => updateField('first_name', e.target.value)} required />
        </Field>

        <Field label="Last Name" error={errors.last_name}>
          <input value={form.last_name} onChange={(e) => updateField('last_name', e.target.value)} required />
        </Field>

        <Field label="Student Number" error={errors.student_number} hint="Letters and numbers only.">
          <input value={form.student_number} onChange={(e) => updateField('student_number', e.target.value)} required />
        </Field>

        <Field label="Email" error={errors.email} hint="Must end with @student.mcu.edu.ph">
          <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="name@student.mcu.edu.ph" required />
        </Field>

        <Field label="Password" error={errors.password} hint="8+ chars with upper, lower, number, and symbol.">
          <input type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} required />
        </Field>

        <h3 className="form-section-title">Academic Information</h3>

        <Field label="Program" error={errors.program_id}>
          <select value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value, section_id: '' })} required>
            <option value="">Select program</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>

        <Field label="Section" error={errors.section_id} hint="Year level is set automatically from the selected section.">
          <select value={form.section_id} onChange={(e) => updateField('section_id', e.target.value)} required disabled={!form.program_id}>
            <option value="">Select section</option>
            {filteredSections.map((s) => (
              <option key={s.id} value={s.id}>
                {formatSectionLabel(s.program_name, s.year_level, s.name, s.semester)}
              </option>
            ))}
          </select>
        </Field>

        {submitError && <p className="form-field__error md:col-span-2">{submitError}</p>}

        <button type="submit" disabled={submitting} className="rounded-lg bg-[#ffb736] px-4 py-2 font-bold text-[#491464] md:col-span-2">
          {submitting ? 'Registering…' : 'Add student'}
        </button>
      </form>

      <section className="student-masterlist card-gold-border p-4">
        <div className="student-masterlist__head">
          <h3 className="student-masterlist__title">View Student Masterlist</h3>
          <p className="student-masterlist__meta">
            {sortedMasterlistStudents.length} student(s) shown
            {sortedMasterlistStudents.length !== students.length ? ` of ${students.length} total` : ''}
          </p>
        </div>

        <div className="student-masterlist__toolbar">
          <div className="form-field student-masterlist__search">
            <label htmlFor="masterlist-search">Search</label>
            <input
              id="masterlist-search"
              type="search"
              placeholder="Search name, email, student no., program, or section…"
              value={masterlistSearch}
              onChange={(e) => setMasterlistSearch(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="masterlist-program-filter">Program</label>
            <select
              id="masterlist-program-filter"
              value={masterlistProgramFilter}
              onChange={(e) => {
                setMasterlistProgramFilter(e.target.value)
                setMasterlistSectionFilter('')
              }}
            >
              <option value="">All programs</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>{program.name}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="masterlist-section-filter">Section</label>
            <select
              id="masterlist-section-filter"
              value={masterlistSectionFilter}
              onChange={(e) => setMasterlistSectionFilter(e.target.value)}
            >
              <option value="">All sections</option>
              {masterlistSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {formatSectionLabel(section.program_name, section.year_level, section.name, section.semester)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="masterlist-presence-filter">Online Status</label>
            <select
              id="masterlist-presence-filter"
              value={masterlistPresenceFilter}
              onChange={(e) => setMasterlistPresenceFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="masterlist-status-filter">Status</label>
            <select
              id="masterlist-status-filter"
              value={masterlistStatusFilter}
              onChange={(e) => setMasterlistStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="masterlist-sort">Sort</label>
            <select
              id="masterlist-sort"
              value={masterlistSort}
              onChange={(e) => setMasterlistSort(e.target.value)}
            >
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        </div>

        {students.length === 0 ? (
          <p className="registry-empty">No students registered yet.</p>
        ) : sortedMasterlistStudents.length === 0 ? (
          <p className="registry-empty">No students match your filters.</p>
        ) : (
          <>
            <ul className="student-masterlist__list">
              {paginatedMasterlistStudents.map((student) => (
                <li key={student.id} className="student-masterlist__item">
                  <div className="student-masterlist__identity">
                    <span
                      className={`student-presence-dot ${student.is_online ? 'student-presence-dot--online' : 'student-presence-dot--offline'}`}
                      title={student.is_online ? 'Online' : 'Offline'}
                      aria-label={student.is_online ? 'Online' : 'Offline'}
                    />
                    <span className="student-masterlist__name">{student.name}</span>
                  </div>
                  <div className="student-masterlist__details">
                    <span>{student.student_profile?.student_number || '—'}</span>
                    <span>{student.student_profile?.program?.name || '—'}</span>
                    <span>{getSectionLabel(student)}</span>
                    <span className="capitalize">{student.student_profile?.academic_status || student.status}</span>
                  </div>
                </li>
              ))}
            </ul>

            {sortedMasterlistStudents.length > MASTERLIST_PAGE_SIZE && (
              <nav className="student-masterlist__pagination" aria-label="Student list pages">
                <button
                  type="button"
                  className="section-browser-pagination__btn"
                  onClick={() => setMasterlistPage((page) => Math.max(1, page - 1))}
                  disabled={masterlistPage <= 1}
                >
                  Previous
                </button>
                <p className="section-browser-pagination__status">
                  Page <strong>{masterlistPage}</strong> of <strong>{masterlistTotalPages}</strong>
                </p>
                <button
                  type="button"
                  className="section-browser-pagination__btn section-browser-pagination__btn--primary"
                  onClick={() => setMasterlistPage((page) => Math.min(masterlistTotalPages, page + 1))}
                  disabled={masterlistPage >= masterlistTotalPages}
                >
                  Next
                </button>
              </nav>
            )}

            <p className="student-masterlist__count">
              Showing {masterlistRangeStart}–{masterlistRangeEnd} of {sortedMasterlistStudents.length} filtered student(s)
            </p>
          </>
        )}
      </section>
    </div>
  )
}
