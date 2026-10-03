import { useEffect, useMemo, useState } from 'react'
import client from '../../api/client'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { useConfirmCountdown } from '../../hooks/useConfirmCountdown'
import {
  SECTION_SEMESTERS,
  YEAR_LEVELS,
  formatSectionLabel,
  sanitizeProgramName,
  sanitizeSectionName,
  sectionSemesterLabel,
  validateProgramForm,
  validateSectionForm,
  yearLevelLabel,
} from '../../utils/academic'
import '../../styles/academic.css'

const PROGRESSION_OPTIONS = [
  { value: 'none', label: 'Do not automatically change student year levels' },
  { value: 'advance_eligible', label: 'Advance eligible students after 2nd Semester' },
  { value: 'manual_review', label: 'Manually review students later' },
]

const SECTIONS_PAGE_SIZE = 20

export default function ProgramsPage() {
  const [programs, setPrograms] = useState([])
  const [academic, setAcademic] = useState({ current: null, periods: [] })
  const [nextPreview, setNextPreview] = useState(null)
  const [programForm, setProgramForm] = useState({ name: '' })
  const [sectionForm, setSectionForm] = useState({ program_id: '', name: '', year_level: '', semester: '' })
  const [programErrors, setProgramErrors] = useState({})
  const [sectionErrors, setSectionErrors] = useState({})
  const [programModalOpen, setProgramModalOpen] = useState(false)
  const [semesterModalOpen, setSemesterModalOpen] = useState(false)
  const [progressionMode, setProgressionMode] = useState('none')
  const [submittingProgram, setSubmittingProgram] = useState(false)
  const [submittingSemester, setSubmittingSemester] = useState(false)
  const [programError, setProgramError] = useState('')
  const [semesterError, setSemesterError] = useState('')
  const [sectionsModalOpen, setSectionsModalOpen] = useState(false)
  const [sectionSearch, setSectionSearch] = useState('')
  const [sectionProgramFilter, setSectionProgramFilter] = useState('')
  const [sectionYearFilter, setSectionYearFilter] = useState('')
  const [sectionPage, setSectionPage] = useState(1)
  const [selectedSection, setSelectedSection] = useState(null)
  const [sectionStudents, setSectionStudents] = useState([])
  const [loadingSectionStudents, setLoadingSectionStudents] = useState(false)
  const [sectionStudentSort, setSectionStudentSort] = useState('name')

  const programConfirm = useConfirmCountdown(programModalOpen)
  const semesterConfirm = useConfirmCountdown(semesterModalOpen)

  const load = () => {
    client.get('/super-admin/programs').then((res) => setPrograms(res.data.programs))
    client.get('/super-admin/academic-periods').then((res) => setAcademic(res.data))
    client.get('/super-admin/academic-periods/current').then((res) => setNextPreview(res.data.next))
  }

  useAutoRefresh(load, [])

  const current = academic.current
  const selectedProgression = PROGRESSION_OPTIONS.find((option) => option.value === progressionMode)

  const openProgramConfirm = (e) => {
    e.preventDefault()
    const validation = validateProgramForm(programForm)
    setProgramErrors(validation)
    if (Object.keys(validation).length) return
    setProgramError('')
    setProgramModalOpen(true)
  }

  const confirmAddProgram = async () => {
    if (!programConfirm.ready) return

    setSubmittingProgram(true)
    setProgramError('')
    try {
      await client.post('/super-admin/programs', { name: sanitizeProgramName(programForm.name) })
      setProgramForm({ name: '' })
      setProgramErrors({})
      setProgramModalOpen(false)
      load()
    } catch (err) {
      setProgramError(err.response?.data?.message || err.response?.data?.errors?.name?.[0] || 'Unable to add program.')
    } finally {
      setSubmittingProgram(false)
    }
  }

  const submitSection = async (e) => {
    e.preventDefault()
    const validation = validateSectionForm(sectionForm)
    setSectionErrors(validation)
    if (Object.keys(validation).length) return

    await client.post('/super-admin/sections', {
      ...sectionForm,
      name: sanitizeSectionName(sectionForm.name),
      year_level: Number(sectionForm.year_level),
      semester: Number(sectionForm.semester),
    })
    setSectionForm({ program_id: '', name: '', year_level: '', semester: '' })
    setSectionErrors({})
    load()
  }

  const completeSemester = async () => {
    if (!semesterConfirm.ready) return

    setSubmittingSemester(true)
    setSemesterError('')
    try {
      await client.post('/super-admin/academic-periods/complete', { progression_mode: progressionMode })
      setSemesterModalOpen(false)
      setProgressionMode('none')
      load()
    } catch (err) {
      setSemesterError(err.response?.data?.message || err.response?.data?.errors?.academic_period?.[0] || 'Unable to complete semester.')
    } finally {
      setSubmittingSemester(false)
    }
  }

  const selectedProgram = programs.find((p) => String(p.id) === String(sectionForm.program_id))
  const previewSectionLabel = selectedProgram && sectionForm.name && sectionForm.year_level && sectionForm.semester
    ? formatSectionLabel(selectedProgram.name, sectionForm.year_level, sanitizeSectionName(sectionForm.name), sectionForm.semester)
    : null
  const programPreviewName = sanitizeProgramName(programForm.name)

  const allSections = useMemo(
    () => programs.flatMap((program) => (program.sections || []).map((section) => ({
      ...section,
      program_id: program.id,
      program_name: program.name,
      display_label: formatSectionLabel(program.name, section.year_level, section.name, section.semester),
    }))),
    [programs],
  )

  const filteredSections = useMemo(() => {
    const query = sectionSearch.trim().toLowerCase()

    return allSections
      .filter((section) => {
        if (sectionProgramFilter && String(section.program_id) !== String(sectionProgramFilter)) {
          return false
        }
        if (sectionYearFilter && String(section.year_level) !== String(sectionYearFilter)) {
          return false
        }
        if (!query) return true
        return [
          section.display_label,
          section.program_name,
          section.name,
          yearLevelLabel(section.year_level),
          sectionSemesterLabel(section.semester),
        ].some((value) => String(value || '').toLowerCase().includes(query))
      })
      .sort((a, b) => {
        const programCompare = a.program_name.localeCompare(b.program_name)
        if (programCompare !== 0) return programCompare
        const yearCompare = Number(a.year_level) - Number(b.year_level)
        if (yearCompare !== 0) return yearCompare
        return a.name.localeCompare(b.name)
      })
  }, [allSections, sectionSearch, sectionProgramFilter, sectionYearFilter])

  const sectionTotalPages = Math.max(1, Math.ceil(filteredSections.length / SECTIONS_PAGE_SIZE))

  const paginatedSections = useMemo(() => {
    const start = (sectionPage - 1) * SECTIONS_PAGE_SIZE
    return filteredSections.slice(start, start + SECTIONS_PAGE_SIZE)
  }, [filteredSections, sectionPage])

  const sectionRangeStart = filteredSections.length === 0 ? 0 : (sectionPage - 1) * SECTIONS_PAGE_SIZE + 1
  const sectionRangeEnd = filteredSections.length === 0
    ? 0
    : Math.min(sectionPage * SECTIONS_PAGE_SIZE, filteredSections.length)

  useEffect(() => {
    setSectionPage(1)
  }, [sectionSearch, sectionProgramFilter, sectionYearFilter])

  useEffect(() => {
    if (sectionPage > sectionTotalPages) {
      setSectionPage(sectionTotalPages)
    }
  }, [sectionPage, sectionTotalPages])

  useEffect(() => {
    if (!sectionsModalOpen) {
      setSelectedSection(null)
      setSectionStudents([])
      return
    }

    setLoadingSectionStudents(true)
    client.get('/super-admin/students')
      .then((res) => setSectionStudents(res.data.students || []))
      .catch(() => setSectionStudents([]))
      .finally(() => setLoadingSectionStudents(false))
  }, [sectionsModalOpen])

  const studentsInSelectedSection = useMemo(() => {
    if (!selectedSection) return []
    return sectionStudents.filter(
      (student) => String(student.student_profile?.section?.id) === String(selectedSection.id),
    )
  }, [sectionStudents, selectedSection])

  const sortedStudentsInSelectedSection = useMemo(() => {
    const list = [...studentsInSelectedSection]

    if (sectionStudentSort === 'number') {
      return list.sort((a, b) => String(a.student_profile?.student_number || '').localeCompare(
        String(b.student_profile?.student_number || ''),
        undefined,
        { numeric: true, sensitivity: 'base' },
      ))
    }

    return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [studentsInSelectedSection, sectionStudentSort])

  const openSectionsModal = () => {
    setSectionSearch('')
    setSectionProgramFilter('')
    setSectionYearFilter('')
    setSectionPage(1)
    setSelectedSection(null)
    setSectionStudentSort('name')
    setSectionsModalOpen(true)
  }

  const openSectionStudents = (section) => {
    setSectionStudentSort('name')
    setSelectedSection(section)
  }

  const backToSectionList = () => {
    setSelectedSection(null)
    setSectionStudentSort('name')
  }

  const renderAcademicPeriodPanel = () => (
    <section className="section-modal-period">
      <div className="section-modal-period__head">
        <div>
          <p className="section-modal-period__label">Academic Period</p>
          <p className="section-modal-period__value">
            {current ? current.label : 'No active period'}
          </p>
          {current && <span className="section-modal-period__status">{current.status}</span>}
        </div>
        {current?.status === 'active' && (
          <button
            type="button"
            className="section-modal-period__action"
            onClick={() => setSemesterModalOpen(true)}
          >
            Complete Semester
          </button>
        )}
      </div>

      {academic.periods?.length > 0 && (
        <div className="section-modal-period__history">
          <p className="section-modal-period__label">History</p>
          <ul className="section-modal-period__history-list">
            {academic.periods.map((period) => (
              <li key={period.id}>
                <span>{period.label}</span>
                <span className="section-modal-period__history-status">{period.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )

  return (
    <div className="space-y-8">
      <PageHeader title="Programs & Sections" description="Manage programs and sections." />

      <form onSubmit={openProgramConfirm} className="card-gold-border p-5">
        <h3 className="form-section-title">Add Program</h3>
        <div className="mt-3 grid gap-3">
          <div className="form-field">
            <label htmlFor="program-name">Program Name</label>
            <input
              id="program-name"
              placeholder="BSIT"
              value={programForm.name}
              onChange={(e) => setProgramForm({ name: sanitizeProgramName(e.target.value) })}
              className="rounded-lg border px-3 py-2 uppercase"
              required
            />
            <p className="form-field__hint">Letters only (example: BSIT, BSCS).</p>
            {programPreviewName && <p className="form-field__hint">Preview: <strong>{programPreviewName}</strong></p>}
            {programErrors.name && <p className="form-field__error">{programErrors.name}</p>}
          </div>
          <button type="submit" className="rounded-lg bg-[#ffb736] px-4 py-2 font-bold text-[#491464] md:justify-self-start">Add program</button>
        </div>
      </form>

      <form onSubmit={submitSection} className="card-gold-border p-5">
        <h3 className="form-section-title">Add Section</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="form-field">
            <label htmlFor="section-program">Program</label>
            <select id="section-program" value={sectionForm.program_id} onChange={(e) => setSectionForm({ ...sectionForm, program_id: e.target.value })} className="rounded-lg border px-3 py-2" required>
              <option value="">Select program</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {sectionErrors.program_id && <p className="form-field__error">{sectionErrors.program_id}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="section-year">Year Level</label>
            <select id="section-year" value={sectionForm.year_level} onChange={(e) => setSectionForm({ ...sectionForm, year_level: e.target.value })} className="rounded-lg border px-3 py-2" required>
              <option value="">Select year level</option>
              {[1, 2, 3, 4].map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
            {sectionErrors.year_level && <p className="form-field__error">{sectionErrors.year_level}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="section-semester">Semester</label>
            <select id="section-semester" value={sectionForm.semester} onChange={(e) => setSectionForm({ ...sectionForm, semester: e.target.value })} className="rounded-lg border px-3 py-2" required>
              <option value="">Select semester</option>
              {SECTION_SEMESTERS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            {sectionErrors.semester && <p className="form-field__error">{sectionErrors.semester}</p>}
          </div>

          <div className="form-field md:col-span-2">
            <label htmlFor="section-name">Section Name</label>
            <input
              id="section-name"
              placeholder="A"
              value={sectionForm.name}
              onChange={(e) => setSectionForm({ ...sectionForm, name: sanitizeSectionName(e.target.value) })}
              className="rounded-lg border px-3 py-2 uppercase"
              required
            />
            <p className="form-field__hint">Letters only. Combined with program and year level (example: BSIT 2A).</p>
            {previewSectionLabel && <p className="form-field__hint">Preview: <strong>{previewSectionLabel}</strong></p>}
            {sectionErrors.name && <p className="form-field__error">{sectionErrors.name}</p>}
          </div>

          <button type="submit" className="rounded-lg bg-[#ffb736] px-4 py-2 font-bold text-[#491464] md:col-span-2 md:justify-self-start">Add section</button>
        </div>
      </form>

      <div className="registry-view card-gold-border p-4">
        <details className="registry-accordion">
          <summary className="registry-accordion__summary">View Added Programs</summary>
          <div className="registry-accordion__body">
            {programs.length === 0 ? (
              <p className="registry-empty">No programs added yet.</p>
            ) : (
              <ul className="registry-program-list">
                {programs.map((program) => (
                  <li key={program.id}>
                    <span>{program.name}</span>
                    <span className="text-sm text-[#5c297c]">{(program.sections || []).length} section(s)</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </div>

      <button type="button" className="registry-sections-btn" onClick={openSectionsModal}>
        <div>
          <p className="registry-sections-btn__title">View Added Sections</p>
          <p className="registry-sections-btn__meta">{allSections.length} section(s) registered</p>
        </div>
        <span className="registry-sections-btn__action">Open list</span>
      </button>

      <Modal
        open={sectionsModalOpen}
        xl
        accessible
        title={selectedSection ? selectedSection.display_label : 'View Added Sections'}
        onClose={() => setSectionsModalOpen(false)}
        footer={(
          <>
            {selectedSection && (
              <button type="button" className="section-browser-pagination__btn" onClick={backToSectionList}>
                Back to sections
              </button>
            )}
            <button type="button" className="modal-close-btn" onClick={() => setSectionsModalOpen(false)}>
              Close
            </button>
          </>
        )}
      >
        <div className="section-browser--accessible">
          {selectedSection ? (
            <div className="section-students-panel">
              <header className="section-students-panel__header">
                <p className="section-students-panel__eyebrow">Section roster</p>
                <h3 className="section-students-panel__title">{selectedSection.display_label}</h3>
                <p className="section-students-panel__meta">
                  {selectedSection.program_name} · {yearLevelLabel(selectedSection.year_level)} · {sectionSemesterLabel(selectedSection.semester)}
                </p>
              </header>

              {loadingSectionStudents ? (
                <p className="section-browser-empty section-browser-empty--panel">Loading students…</p>
              ) : studentsInSelectedSection.length === 0 ? (
                <p className="section-browser-empty section-browser-empty--panel">No students registered in this section yet.</p>
              ) : (
                <>
                  <div className="section-student-sort">
                    <label htmlFor="section-student-sort">Sort students</label>
                    <select
                      id="section-student-sort"
                      value={sectionStudentSort}
                      onChange={(e) => setSectionStudentSort(e.target.value)}
                    >
                      <option value="name">Name (A–Z)</option>
                      <option value="number">Student No.</option>
                    </select>
                  </div>

                  <div className="section-student-cards">
                    {sortedStudentsInSelectedSection.map((student) => (
                      <article key={student.id} className="section-student-card">
                        <div className="section-student-card__top">
                          <h4 className="section-student-card__name">{student.name}</h4>
                          <span className="section-student-card__number">
                            {student.student_profile?.student_number || '—'}
                          </span>
                        </div>
                        <dl className="section-student-card__details">
                          <div className="section-student-card__field">
                            <dt>Email</dt>
                            <dd>{student.email}</dd>
                          </div>
                          <div className="section-student-card__field">
                            <dt>Year</dt>
                            <dd>{student.student_profile?.year_level_label || yearLevelLabel(student.student_profile?.year_level) || '—'}</dd>
                          </div>
                          <div className="section-student-card__field">
                            <dt>Period</dt>
                            <dd>{student.student_profile?.current_period?.label || '—'}</dd>
                          </div>
                          <div className="section-student-card__field">
                            <dt>Status</dt>
                            <dd className="capitalize">{student.student_profile?.academic_status || student.status || '—'}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                </>
              )}

              {!loadingSectionStudents && (
                <p className="section-browser-count section-browser-count--panel">
                  {studentsInSelectedSection.length} student(s) in this section
                </p>
              )}

              {renderAcademicPeriodPanel()}
            </div>
          ) : (
            <>
              <div className="section-browser-toolbar">
                <div className="form-field">
                  <label htmlFor="section-search">Search</label>
                  <input
                    id="section-search"
                    type="search"
                    placeholder="Type to search sections…"
                    value={sectionSearch}
                    onChange={(e) => setSectionSearch(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="section-program-filter">Program</label>
                  <select
                    id="section-program-filter"
                    value={sectionProgramFilter}
                    onChange={(e) => setSectionProgramFilter(e.target.value)}
                  >
                    <option value="">All programs</option>
                    {programs.map((program) => (
                      <option key={program.id} value={program.id}>{program.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="section-year-filter">Year Level</label>
                  <select
                    id="section-year-filter"
                    value={sectionYearFilter}
                    onChange={(e) => setSectionYearFilter(e.target.value)}
                  >
                    <option value="">All year levels</option>
                    {YEAR_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>{level.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="section-browser-hint">Click a section row to view its registered students.</p>

              <div className="section-browser-table-wrap">
                <table className="section-browser-table">
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th>Program</th>
                      <th>Year Level</th>
                      <th>Semester</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSections.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="section-browser-empty">No sections match your filters.</td>
                      </tr>
                    ) : (
                      paginatedSections.map((section) => (
                        <tr
                          key={section.id}
                          className="section-browser-table__row--clickable"
                          onClick={() => openSectionStudents(section)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              openSectionStudents(section)
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`View students in ${section.display_label}`}
                        >
                          <td className="section-browser-table__primary">{section.display_label}</td>
                          <td>{section.program_name}</td>
                          <td>{yearLevelLabel(section.year_level)}</td>
                          <td>{sectionSemesterLabel(section.semester)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {filteredSections.length > SECTIONS_PAGE_SIZE && (
                <nav className="section-browser-pagination" aria-label="Section list pages">
                  <button
                    type="button"
                    className="section-browser-pagination__btn"
                    onClick={() => setSectionPage((page) => Math.max(1, page - 1))}
                    disabled={sectionPage <= 1}
                  >
                    Previous
                  </button>
                  <p className="section-browser-pagination__status">
                    Page <strong>{sectionPage}</strong> of <strong>{sectionTotalPages}</strong>
                  </p>
                  <button
                    type="button"
                    className="section-browser-pagination__btn section-browser-pagination__btn--primary"
                    onClick={() => setSectionPage((page) => Math.min(sectionTotalPages, page + 1))}
                    disabled={sectionPage >= sectionTotalPages}
                  >
                    Next
                  </button>
                </nav>
              )}

              <p className="section-browser-count">
                Showing {sectionRangeStart}–{sectionRangeEnd} of {filteredSections.length} filtered section(s)
                {filteredSections.length !== allSections.length ? ` (${allSections.length} total)` : ''}
              </p>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={programModalOpen}
        title="Confirm Add Program"
        onClose={() => !submittingProgram && setProgramModalOpen(false)}
        footer={(
          <>
            <button type="button" className="rounded-lg border border-[#5c297c]/20 px-4 py-2 text-sm font-semibold text-[#491464]" onClick={() => setProgramModalOpen(false)} disabled={submittingProgram}>
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-[#ffb736] px-4 py-2 text-sm font-bold text-[#491464] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={confirmAddProgram}
              disabled={submittingProgram || !programConfirm.ready}
            >
              {submittingProgram ? 'Adding…' : programConfirm.ready ? 'Confirm Add Program' : `Confirm (${programConfirm.countdown}s)`}
            </button>
          </>
        )}
      >
        <p className="text-sm text-[#5c297c]">Review the program below before confirming.</p>
        <div className="mt-4 rounded-lg border border-[#5c297c]/12 bg-[#f8f5fc] p-4 text-sm">
          <p className="font-semibold text-[#491464]">Changes</p>
          <ul className="mt-2 space-y-2 text-[#5c297c]">
            <li>
              <span className="font-semibold text-[#491464]">New program</span>
              <br />
              {programPreviewName || '—'}
            </li>
            <li>
              <span className="font-semibold text-[#491464]">Status</span>
              <br />
              Active and available for sections and student registration
            </li>
          </ul>
        </div>
        {!programConfirm.ready && (
          <p className="form-field__hint mt-3">Confirm unlocks in {programConfirm.countdown} second{programConfirm.countdown === 1 ? '' : 's'}.</p>
        )}
        {programError && <p className="form-field__error mt-3">{programError}</p>}
      </Modal>

      <Modal
        open={semesterModalOpen}
        title="Confirm Semester Completion"
        onClose={() => !submittingSemester && setSemesterModalOpen(false)}
        footer={(
          <>
            <button type="button" className="rounded-lg border border-[#5c297c]/20 px-4 py-2 text-sm font-semibold text-[#491464]" onClick={() => setSemesterModalOpen(false)} disabled={submittingSemester}>
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-[#ffb736] px-4 py-2 text-sm font-bold text-[#491464] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={completeSemester}
              disabled={submittingSemester || !semesterConfirm.ready}
            >
              {submittingSemester ? 'Completing…' : semesterConfirm.ready ? 'Confirm Complete Semester' : `Confirm (${semesterConfirm.countdown}s)`}
            </button>
          </>
        )}
      >
        <p className="text-sm text-[#5c297c]">Review the changes below before confirming.</p>

        <div className="mt-4 rounded-lg border border-[#5c297c]/12 bg-[#f8f5fc] p-4 text-sm">
          <p className="font-semibold text-[#491464]">Changes</p>
          <ul className="mt-2 space-y-2 text-[#5c297c]">
            <li>
              <span className="font-semibold text-[#491464]">Current period</span>
              <br />
              {current?.label || '—'} → marked completed
            </li>
            <li>
              <span className="font-semibold text-[#491464]">Next period</span>
              <br />
              {nextPreview?.label || '—'} → set active
            </li>
            <li>
              <span className="font-semibold text-[#491464]">Student progression</span>
              <br />
              {selectedProgression?.label}
            </li>
            <li>
              <span className="font-semibold text-[#491464]">Academic history</span>
              <br />
              Current student records preserved; new period records created.
            </li>
          </ul>
        </div>

        <p className="mt-5 text-sm font-semibold text-[#491464]">Student Progression</p>
        {PROGRESSION_OPTIONS.map((option) => (
          <label key={option.value} className="progression-option">
            <input
              type="radio"
              name="progression"
              value={option.value}
              checked={progressionMode === option.value}
              onChange={() => setProgressionMode(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}

        {!semesterConfirm.ready && (
          <p className="form-field__hint mt-3">Confirm unlocks in {semesterConfirm.countdown} second{semesterConfirm.countdown === 1 ? '' : 's'}.</p>
        )}
        {semesterError && <p className="form-field__error mt-3">{semesterError}</p>}
      </Modal>
    </div>
  )
}
