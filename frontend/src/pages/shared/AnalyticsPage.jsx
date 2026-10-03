import { useEffect, useMemo, useState } from 'react'
import client from '../../api/client'
import LoadingScreen from '../../components/LoadingScreen'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { formatSectionLabel } from '../../utils/academic'
import '../../styles/academic.css'
import '../../styles/analytics.css'

const MASTERLIST_PAGE_SIZE = 50

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatScore(value) {
  if (value === null || value === undefined || value === '') return '—'
  return `${Number(value).toFixed(1)}%`
}

function formatActivityType(type) {
  if (!type) return '—'
  return type.replace(/_/g, ' ')
}

function getSectionLabel(student) {
  return student.student_profile?.section?.display_label
    || (student.student_profile?.program?.name && student.student_profile?.section?.name
      ? formatSectionLabel(
        student.student_profile.program.name,
        student.student_profile.year_level,
        student.student_profile.section.name,
        student.student_profile.section.semester,
      )
      : '—')
}

function studentDetailEndpoint(baseEndpoint, studentId) {
  return `${baseEndpoint}/students/${studentId}`
}

function SuperAdminSummary({ data }) {
  const { institutional, activities } = data

  return (
    <section className="analytics-summary" aria-label="Institutional overview">
      <article className="analytics-summary__card card-gold-border">
        <p className="analytics-summary__label">Average score</p>
        <p className="analytics-summary__value">{formatScore(institutional?.average_score)}</p>
        <p className="analytics-summary__hint">Across all submitted attempts</p>
      </article>
      <article className="analytics-summary__card card-gold-border">
        <p className="analytics-summary__label">Total submissions</p>
        <p className="analytics-summary__value">{institutional?.total_attempts ?? 0}</p>
        <p className="analytics-summary__hint">Completed student attempts</p>
      </article>
      <article className="analytics-summary__card card-gold-border">
        <p className="analytics-summary__label">Most completed</p>
        <p className="analytics-summary__value">{activities?.highest_completion?.[0]?.done_count ?? 0}</p>
        <p className="analytics-summary__hint">
          {activities?.highest_completion?.[0]?.title || 'No activities yet'}
        </p>
      </article>
      <article className="analytics-summary__card card-gold-border">
        <p className="analytics-summary__label">Students tracked</p>
        <p className="analytics-summary__value">{data.students?.length ?? 0}</p>
        <p className="analytics-summary__hint">Registered in masterlist</p>
      </article>
    </section>
  )
}

function FacultySummary({ data }) {
  return (
    <section className="analytics-summary" aria-label="Faculty overview">
      <article className="analytics-summary__card card-gold-border">
        <p className="analytics-summary__label">Activities created</p>
        <p className="analytics-summary__value">{data.activities_created ?? 0}</p>
      </article>
      <article className="analytics-summary__card card-gold-border">
        <p className="analytics-summary__label">Published</p>
        <p className="analytics-summary__value">{data.activities_published ?? 0}</p>
      </article>
      <article className="analytics-summary__card card-gold-border">
        <p className="analytics-summary__label">Participation</p>
        <p className="analytics-summary__value">{data.participation ?? 0}</p>
        <p className="analytics-summary__hint">Submitted on your activities</p>
      </article>
      <article className="analytics-summary__card card-gold-border">
        <p className="analytics-summary__label">Completion rate</p>
        <p className="analytics-summary__value">{formatScore(data.completion_rate)}</p>
      </article>
    </section>
  )
}

function StudentActivityModal({ open, student, detail, loading, error, onClose, showCreator }) {
  const title = student ? `${student.name} — Activity history` : 'Student activity history'

  return (
    <Modal open={open} title={title} onClose={onClose} wide xl>
      {loading && <LoadingScreen compact fullscreen={false} message="Loading activity history…" />}
      {error && <p className="registry-empty">{error}</p>}
      {!loading && !error && detail && (
        <>
          <p className="analytics-detail__meta">
            {detail.student?.student_profile?.student_number || '—'}
            {' · '}
            {getSectionLabel(detail.student)}
            {' · '}
            {detail.student?.email}
          </p>

          <div className="analytics-detail__summary">
            <div className="analytics-detail__stat">
              <p className="analytics-detail__stat-label">Activities taken</p>
              <p className="analytics-detail__stat-value">{detail.summary?.activities_taken ?? 0}</p>
            </div>
            <div className="analytics-detail__stat">
              <p className="analytics-detail__stat-label">Average score</p>
              <p className="analytics-detail__stat-value">{formatScore(detail.summary?.average_score)}</p>
            </div>
            <div className="analytics-detail__stat">
              <p className="analytics-detail__stat-label">Highest score</p>
              <p className="analytics-detail__stat-value">{formatScore(detail.summary?.highest_score)}</p>
            </div>
          </div>

          {detail.records?.length ? (
            <div className="analytics-detail__table-wrap">
              <table className="analytics-detail__table">
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th>Type</th>
                    {showCreator && <th>Faculty</th>}
                    <th>Status</th>
                    <th>Score</th>
                    <th>Accuracy</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.activity?.title || '—'}</td>
                      <td className="capitalize">{formatActivityType(record.activity?.type)}</td>
                      {showCreator && <td>{record.activity?.creator?.name || '—'}</td>}
                      <td>
                        <span className={`analytics-status analytics-status--${record.status}`}>
                          {record.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        {record.score?.percentage != null ? (
                          <span className="analytics-score">{formatScore(record.score.percentage)}</span>
                        ) : (
                          <span className="analytics-score analytics-score--muted">—</span>
                        )}
                      </td>
                      <td>
                        {record.score?.accuracy != null ? formatScore(record.score.accuracy) : '—'}
                      </td>
                      <td>{formatDate(record.submitted_at || record.started_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="analytics-empty">No activity attempts recorded yet.</p>
          )}
        </>
      )}
    </Modal>
  )
}

export default function AnalyticsPage({ endpoint }) {
  const [data, setData] = useState(null)
  const [programs, setPrograms] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentDetail, setStudentDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [masterlistSearch, setMasterlistSearch] = useState('')
  const [masterlistProgramFilter, setMasterlistProgramFilter] = useState('')
  const [masterlistSectionFilter, setMasterlistSectionFilter] = useState('')
  const [masterlistSort, setMasterlistSort] = useState('name')
  const [masterlistPage, setMasterlistPage] = useState(1)

  const isSuperAdmin = endpoint.includes('super-admin')
  const showCreator = isSuperAdmin

  const load = () => client.get(endpoint).then((res) => setData(res.data))
  useAutoRefresh(load, [endpoint])

  useEffect(() => {
    client.get('/programs').then((res) => setPrograms(res.data.programs || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedStudent) {
      setStudentDetail(null)
      setDetailError('')
      return undefined
    }

    setDetailLoading(true)
    setDetailError('')
    setStudentDetail(null)

    const controller = new AbortController()

    client
      .get(studentDetailEndpoint(endpoint, selectedStudent.id), { signal: controller.signal })
      .then((res) => setStudentDetail(res.data))
      .catch((err) => {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          setDetailError('Unable to load this student’s activity history.')
        }
      })
      .finally(() => setDetailLoading(false))

    return () => controller.abort()
  }, [selectedStudent, endpoint])

  const sections = useMemo(
    () => programs.flatMap((program) => (program.sections || []).map((section) => ({
      ...section,
      program_id: program.id,
      program_name: program.name,
    }))),
    [programs],
  )

  const masterlistSections = sections.filter(
    (section) => !masterlistProgramFilter || String(section.program_id) === String(masterlistProgramFilter),
  )

  const students = data?.students || []

  const filteredStudents = useMemo(() => {
    const query = masterlistSearch.trim().toLowerCase()

    return students.filter((student) => {
      const profile = student.student_profile
      const programId = profile?.program?.id
      const sectionId = profile?.section?.id

      if (masterlistProgramFilter && String(programId) !== String(masterlistProgramFilter)) {
        return false
      }
      if (masterlistSectionFilter && String(sectionId) !== String(masterlistSectionFilter)) {
        return false
      }
      if (query) {
        const matchesSearch = [
          student.name,
          student.email,
          profile?.student_number,
          profile?.program?.name,
          getSectionLabel(student),
        ].some((value) => String(value || '').toLowerCase().includes(query))

        if (!matchesSearch) return false
      }
      return true
    })
  }, [students, masterlistProgramFilter, masterlistSectionFilter, masterlistSearch])

  const sortedStudents = useMemo(() => {
    const list = [...filteredStudents]

    list.sort((a, b) => {
      const analyticsA = a.analytics || {}
      const analyticsB = b.analytics || {}

      switch (masterlistSort) {
        case 'name-desc':
          return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' })
        case 'score-desc':
          return (analyticsB.average_score ?? -1) - (analyticsA.average_score ?? -1)
            || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        case 'score-asc':
          return (analyticsA.average_score ?? 101) - (analyticsB.average_score ?? 101)
            || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        case 'activities-desc':
          return (analyticsB.activities_taken ?? 0) - (analyticsA.activities_taken ?? 0)
            || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        case 'activities-asc':
          return (analyticsA.activities_taken ?? 0) - (analyticsB.activities_taken ?? 0)
            || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        case 'recent':
          return new Date(analyticsB.last_activity_at || 0).getTime()
            - new Date(analyticsA.last_activity_at || 0).getTime()
            || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        default:
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      }
    })

    return list
  }, [filteredStudents, masterlistSort])

  const masterlistTotalPages = Math.max(1, Math.ceil(sortedStudents.length / MASTERLIST_PAGE_SIZE))

  const paginatedStudents = useMemo(() => {
    const start = (masterlistPage - 1) * MASTERLIST_PAGE_SIZE
    return sortedStudents.slice(start, start + MASTERLIST_PAGE_SIZE)
  }, [sortedStudents, masterlistPage])

  useEffect(() => {
    setMasterlistPage(1)
  }, [masterlistSearch, masterlistProgramFilter, masterlistSectionFilter, masterlistSort])

  useEffect(() => {
    if (masterlistPage > masterlistTotalPages) {
      setMasterlistPage(masterlistTotalPages)
    }
  }, [masterlistPage, masterlistTotalPages])

  const masterlistRangeStart = sortedStudents.length === 0
    ? 0
    : (masterlistPage - 1) * MASTERLIST_PAGE_SIZE + 1
  const masterlistRangeEnd = Math.min(masterlistPage * MASTERLIST_PAGE_SIZE, sortedStudents.length)

  if (!data) {
    return (
      <div className="analytics-page">
        <PageHeader title="Analytics" description="Performance overview and student activity insights." />
        <LoadingScreen compact fullscreen={false} message="Loading analytics…" />
      </div>
    )
  }

  return (
    <div className="analytics-page">
      <PageHeader
        title="Analytics"
        description="Review performance summaries, browse the student masterlist, and inspect individual activity history."
      />

      {isSuperAdmin ? <SuperAdminSummary data={data} /> : <FacultySummary data={data} />}

      <section className="student-masterlist card-gold-border p-4">
        <div className="student-masterlist__head">
          <h3 className="student-masterlist__title">Student Masterlist</h3>
          <p className="student-masterlist__meta">
            {sortedStudents.length} student(s) shown
            {sortedStudents.length !== students.length ? ` of ${students.length} total` : ''}
            {' · '}
            Click a student to view their past activities and scores
          </p>
        </div>

        <div className="student-masterlist__toolbar">
          <div className="form-field student-masterlist__search">
            <label htmlFor="analytics-masterlist-search">Search</label>
            <input
              id="analytics-masterlist-search"
              type="search"
              placeholder="Search name, email, student no., program, or section…"
              value={masterlistSearch}
              onChange={(e) => setMasterlistSearch(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="analytics-masterlist-program-filter">Program</label>
            <select
              id="analytics-masterlist-program-filter"
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
            <label htmlFor="analytics-masterlist-section-filter">Section</label>
            <select
              id="analytics-masterlist-section-filter"
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
            <label htmlFor="analytics-masterlist-sort">Sort</label>
            <select
              id="analytics-masterlist-sort"
              value={masterlistSort}
              onChange={(e) => setMasterlistSort(e.target.value)}
            >
              <option value="name">Name (A–Z)</option>
              <option value="name-desc">Name (Z–A)</option>
              <option value="score-desc">Highest average score</option>
              <option value="score-asc">Lowest average score</option>
              <option value="activities-desc">Most activities taken</option>
              <option value="activities-asc">Fewest activities taken</option>
              <option value="recent">Most recent activity</option>
            </select>
          </div>
        </div>

        {students.length === 0 ? (
          <p className="registry-empty">No students registered yet.</p>
        ) : sortedStudents.length === 0 ? (
          <p className="registry-empty">No students match your filters.</p>
        ) : (
          <>
            <ul className="student-masterlist__list">
              {paginatedStudents.map((student) => (
                <li key={student.id}>
                  <button
                    type="button"
                    className="student-masterlist__item student-masterlist__item--clickable"
                    onClick={() => setSelectedStudent(student)}
                  >
                    <div className="student-masterlist__identity">
                      <span
                        className={`student-presence-dot ${student.is_online ? 'student-presence-dot--online' : 'student-presence-dot--offline'}`}
                        title={student.is_online ? 'Online' : 'Offline'}
                        aria-hidden="true"
                      />
                      <span className="student-masterlist__name">{student.name}</span>
                    </div>
                    <div className="student-masterlist__details">
                      <span>{student.student_profile?.student_number || '—'}</span>
                      <span>{student.student_profile?.program?.name || '—'}</span>
                      <span>{getSectionLabel(student)}</span>
                    </div>
                    <div className="student-masterlist__analytics">
                      <span>
                        Taken: <strong>{student.analytics?.activities_taken ?? 0}</strong>
                      </span>
                      <span>
                        Avg score: <strong>{formatScore(student.analytics?.average_score)}</strong>
                      </span>
                      <span>
                        Last activity: <strong>{formatDate(student.analytics?.last_activity_at)}</strong>
                      </span>
                    </div>
                    <span className="student-masterlist__chevron" aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>

            {sortedStudents.length > MASTERLIST_PAGE_SIZE && (
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
              Showing {masterlistRangeStart}–{masterlistRangeEnd} of {sortedStudents.length} filtered student(s)
            </p>
          </>
        )}
      </section>

      <StudentActivityModal
        open={Boolean(selectedStudent)}
        student={selectedStudent}
        detail={studentDetail}
        loading={detailLoading}
        error={detailError}
        showCreator={showCreator}
        onClose={() => setSelectedStudent(null)}
      />
    </div>
  )
}
