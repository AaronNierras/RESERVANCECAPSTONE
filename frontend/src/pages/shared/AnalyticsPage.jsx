import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import client from '../../api/client'
import LoadingScreen from '../../components/LoadingScreen'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { formatSectionLabel } from '../../utils/academic'
import { buildAnalyticsGroups, scoreBand } from '../../utils/analyticsDetail'
import { formatShare, PERFORMANCE_BANDS, performanceDistribution, sortAnalyticsRows } from '../../utils/dashboardAnalytics'
import '../../styles/academic.css'
import '../../styles/analytics.css'

const STUDENT_PAGE_SIZE = 30

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
        student.student_profile.program.code || student.student_profile.program.name,
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

const BAND_STYLE = {
  ...Object.fromEntries(PERFORMANCE_BANDS.map((band) => [band.label, band])),
  'No score yet': { color: '#5c297c', ink: '#5c297c', range: 'No average yet' },
}

const COURSE_SORTS = [
  ['score-desc', 'Highest Average Score'],
  ['score-asc', 'Lowest Average Score'],
  ['students-desc', 'Most Students'],
  ['students-asc', 'Fewest Students'],
  ['name-asc', 'Name (A–Z)'],
  ['name-desc', 'Name (Z–A)'],
]

const SECTION_SORTS = [
  ['score-desc', 'Highest Average Score'],
  ['score-asc', 'Lowest Average Score'],
  ['students-desc', 'Most Students'],
  ['students-asc', 'Fewest Students'],
  ['activities-desc', 'Most Activities Taken'],
  ['activities-asc', 'Fewest Activities Taken'],
  ['name-asc', 'Section Name (A–Z)'],
  ['name-desc', 'Section Name (Z–A)'],
]

function numericScore(value) {
  if (value === null || value === undefined || value === '') return null
  const score = Number(value)
  return Number.isFinite(score) ? score : null
}

function sortPeople(people, sort) {
  const list = [...people]
  list.sort((a, b) => {
    const name = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    const scoreA = numericScore(a.analytics?.average_score)
    const scoreB = numericScore(b.analytics?.average_score)
    if (sort === 'name-desc') return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' })
    if (sort === 'score-asc') return (scoreA ?? Number.POSITIVE_INFINITY) - (scoreB ?? Number.POSITIVE_INFINITY) || name
    if (sort === 'activities-desc') return (b.analytics?.activities_taken ?? 0) - (a.analytics?.activities_taken ?? 0) || name
    if (sort === 'activities-asc') return (a.analytics?.activities_taken ?? 0) - (b.analytics?.activities_taken ?? 0) || name
    if (sort === 'score-desc') return (scoreB ?? Number.NEGATIVE_INFINITY) - (scoreA ?? Number.NEGATIVE_INFINITY) || name
    return name
  })
  return list
}

function AccordionItem({ title, meta, color, children, actions }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`analytics-acc ${open ? 'is-open' : ''}`}>
      <div className="analytics-acc__bar">
        <button type="button" className="analytics-acc__trigger" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          <i className="analytics-acc__dot" style={{ background: color }} />
          <span className="analytics-acc__title">{title}</span>
          <span className="analytics-acc__meta">{meta}</span>
          <span className="analytics-acc__icon" aria-hidden="true">{open ? '−' : '+'}</span>
        </button>
        {actions ? <div className="analytics-acc__actions">{actions}</div> : null}
      </div>
      {open && <div className="analytics-acc__panel">{children}</div>}
    </div>
  )
}

function PerformanceTooltip({ active, payload }) {
  const item = payload?.[0]?.payload
  if (!active || !item) return null
  const noun = item.count === 1 ? 'student' : 'students'
  return (
    <div className="analytics-pie__tip">
      <strong>{item.label}</strong>
      <span>{item.range}</span>
      <span>{item.count} {noun} ({formatShare(item.percent)})</span>
    </div>
  )
}

function PerformancePie({ students }) {
  const distribution = useMemo(() => performanceDistribution(students), [students])
  const slices = distribution.bands.filter((band) => band.count > 0)

  return (
    <article className="analytics-pie" aria-label="Student Performance Distribution">
      <h3>Student Performance Distribution</h3>
      <p>Uses average scores for the course and section selected above.</p>
      {distribution.scored === 0 ? (
        <p className="analytics-pie__empty">No student performance data available</p>
      ) : (
        <div className="analytics-pie__body">
          <div className="analytics-pie__chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slices} dataKey="count" nameKey="label" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="#fff">
                  {slices.map((slice) => <Cell key={slice.key} fill={slice.color} />)}
                </Pie>
                <Tooltip content={<PerformanceTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <p className="analytics-pie__center">
              <strong>{distribution.scored}</strong>
              <span>scored</span>
            </p>
          </div>
          <ul className="analytics-pie__legend">
            {distribution.bands.map((band) => (
              <li key={band.key}>
                <span><i style={{ background: band.color }} /> {band.label} <em>{band.range}</em></span>
                <strong>{band.count} · {formatShare(band.percent)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}

function StudentTable({ people, onSelect, pageKey }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(people.length / STUDENT_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * STUDENT_PAGE_SIZE
  const visible = people.slice(start, start + STUDENT_PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [pageKey])

  if (!people.length) return <p className="analytics-empty">No students in this group for the current filter.</p>
  return (
    <>
      <div className="analytics-detail__table-wrap">
        <table className="analytics-detail__table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Performance</th>
              <th>Average</th>
              <th>Activities</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((student) => {
              const band = scoreBand(student.analytics?.average_score) || 'No score yet'
              return (
                <tr key={student.id}>
                  <td>
                    <button type="button" className="analytics-student-link" onClick={() => onSelect(student)}>
                      {student.name}
                    </button>
                    <span className="analytics-student-link__meta">{student.student_profile?.student_number || 'No student number'}</span>
                  </td>
                  <td><span className="analytics-band" style={{ color: BAND_STYLE[band].ink }}>{band}</span></td>
                  <td>{formatScore(student.analytics?.average_score)}</td>
                  <td>{student.analytics?.activities_taken ?? 0}</td>
                  <td>{formatDate(student.analytics?.last_activity_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {people.length > STUDENT_PAGE_SIZE && (
        <nav className="analytics-pager no-print" aria-label="Student pages">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1}>Previous</button>
          <p>Showing {start + 1}–{Math.min(start + STUDENT_PAGE_SIZE, people.length)} of {people.length}</p>
          <button type="button" className="is-next" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages}>Next</button>
        </nav>
      )}
    </>
  )
}

function GroupAccordion({ group, people, onSelect, pageKey, reportTitle }) {
  return (
    <div className="analytics-print-root" data-print-root>
      <AccordionItem
        title={group.label}
        color="#491464"
        meta={`${group.detail ? `${group.detail} · ` : ''}${group.students} students · ${formatScore(group.average)} avg`}
        actions={<PrintButton label="Print report" />}
      >
        <dl className="analytics-group__stats">
          <div><dt>Students</dt><dd>{group.students}</dd></div>
          <div><dt>With a score</dt><dd>{group.scored}</dd></div>
          <div><dt>Average</dt><dd>{formatScore(group.average)}</dd></div>
          <div><dt>Highest</dt><dd>{group.highest ? `${group.highest.name} · ${formatScore(group.highest.score)}` : '—'}</dd></div>
          <div><dt>Lowest</dt><dd>{group.lowest ? `${group.lowest.name} · ${formatScore(group.lowest.score)}` : '—'}</dd></div>
          <div><dt>Activities taken</dt><dd>{group.activities}</dd></div>
        </dl>
        <ul className="analytics-group__bands">
          {Object.entries(group.bands).map(([label, count]) => (
            <li key={label} style={{ borderColor: BAND_STYLE[label].color }}>
              <i style={{ background: BAND_STYLE[label].color }} />
              <strong>{count}</strong> {label}
            </li>
          ))}
        </ul>
        <StudentTable people={people} onSelect={onSelect} pageKey={pageKey || group.key} />
      </AccordionItem>
      <article className="analytics-formal">
        <header className="analytics-formal__mast">
          <p className="analytics-formal__brand">RESERVANCE</p>
          <p className="analytics-formal__office">Program Chair · Academic Report</p>
          <h1>{reportTitle}</h1>
          <p className="analytics-formal__kicker">{group.label}{group.detail ? ` · ${group.detail}` : ''}</p>
        </header>
        <p className="analytics-formal__meta">Prepared {reportStamp()}</p>
        <p>
          {group.students} student{group.students === 1 ? '' : 's'}, {group.scored} with a score.
          Average {formatScore(group.average)}.
          Highest {group.highest ? `${group.highest.name}, ${formatScore(group.highest.score)}` : 'none recorded'}.
          Lowest {group.lowest ? `${group.lowest.name}, ${formatScore(group.lowest.score)}` : 'none recorded'}.
          Activities taken {group.activities}.
          Performance: Excellent {group.bands.Excellent}, Good {group.bands.Good}, Satisfactory {group.bands.Satisfactory}, Needs Improvement {group.bands['Needs Improvement']}.
        </p>
        <FormalStudentRows people={people} />
        <footer className="analytics-formal__foot">RESERVANCE · Scores recorded at the time of printing · For academic review</footer>
      </article>
    </div>
  )
}

function reportStamp() {
  return new Date().toLocaleString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function FormalStudentRows({ people }) {
  const rows = sortPeople(people, 'score-desc')
  if (!rows.length) return <p className="analytics-formal__empty">No students are recorded in this group.</p>
  return (
    <table className="analytics-formal__table">
      <thead>
        <tr>
          <th>No.</th>
          <th>Student</th>
          <th>Student number</th>
          <th>Section</th>
          <th>Performance</th>
          <th>Average</th>
          <th>Activities taken</th>
          <th>Last activity</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((student, index) => {
          const band = scoreBand(student.analytics?.average_score) || 'No score yet'
          return (
            <tr key={student.id}>
              <td>{index + 1}</td>
              <td>{student.name}</td>
              <td>{student.student_profile?.student_number || '—'}</td>
              <td>{getSectionLabel(student)}</td>
              <td>{band}</td>
              <td>{formatScore(student.analytics?.average_score)}</td>
              <td>{student.analytics?.activities_taken ?? 0}</td>
              <td>{formatDate(student.analytics?.last_activity_at)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function printThisContainer(event) {
  const root = event.currentTarget.closest('[data-print-root]')
  const formal = root?.querySelector('.analytics-formal')
  if (!formal) return

  document.getElementById('analytics-print-host')?.remove()
  const host = document.createElement('article')
  host.id = 'analytics-print-host'
  host.className = 'analytics-formal'
  host.innerHTML = formal.innerHTML
  document.body.appendChild(host)
  document.body.dataset.analyticsPrint = 'item'

  const cleanup = () => {
    delete document.body.dataset.analyticsPrint
    host.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.setTimeout(() => window.print(), 80)
}

function PrintButton({ label = 'Print' }) {
  return (
    <button type="button" className="analytics-print no-print" onClick={printThisContainer}>
      {label}
    </button>
  )
}

function DetailedAnalytics({ students, courses, sections, activities, faculty, courseSort, sectionSort, onSelect }) {
  const bands = useMemo(() => {
    const buckets = { Excellent: [], Good: [], Satisfactory: [], 'Needs Improvement': [], 'No score yet': [] }
    students.forEach((student) => {
      const band = scoreBand(student.analytics?.average_score) || 'No score yet'
      buckets[band].push(student)
    })
    return buckets
  }, [students])

  return (
    <>
      <div className="analytics-panel" data-panel="performance">
        <PerformancePie students={students} />
        <div className="analytics-acc-list">
          {Object.entries(bands).map(([label, people]) => (
            <AccordionItem
              key={label}
              title={label}
              color={BAND_STYLE[label].color}
              meta={`${people.length} ${people.length === 1 ? 'student' : 'students'} · ${BAND_STYLE[label].range}`}
            >
              <StudentTable people={sortPeople(people, 'score-desc')} onSelect={onSelect} pageKey={label} />
            </AccordionItem>
          ))}
        </div>
      </div>
      <div className="analytics-panel" data-panel="courses">
        <div className="analytics-acc-list">
          {courses.map((group) => (
            <GroupAccordion key={group.key} group={group} people={sortPeople(group.people, courseSort)} onSelect={onSelect} pageKey={`${group.key}-${courseSort}`} reportTitle="Course Performance Report" />
          ))}
        </div>
      </div>
      <div className="analytics-panel" data-panel="sections">
        <div className="analytics-acc-list">
          {sections.map((group) => (
            <GroupAccordion key={group.key} group={group} people={sortPeople(group.people, sectionSort)} onSelect={onSelect} pageKey={`${group.key}-${sectionSort}`} reportTitle="Section Performance Report" />
          ))}
        </div>
      </div>
      <div className="analytics-panel" data-panel="activities">
        <section className="analytics-insights" aria-label="Activity and faculty detail">
          <article className="card-gold-border analytics-print-root" data-print-root>
            <div className="analytics-print-root__actions no-print">
              <h3>Most completed activities</h3>
              <PrintButton label="Print report" />
            </div>
            {(activities?.highest_completion || []).length === 0 ? (
              <p className="analytics-empty">No completed activities yet.</p>
            ) : (
              <ol>
                {activities.highest_completion.map((activity) => (
                  <li key={activity.id}><span>{activity.title}</span><strong>{activity.done_count} submitted</strong></li>
                ))}
              </ol>
            )}
            <article className="analytics-formal">
              <header className="analytics-formal__mast">
                <p className="analytics-formal__brand">RESERVANCE</p>
                <p className="analytics-formal__office">Program Chair · Academic Report</p>
                <h1>Most Completed Activities</h1>
              </header>
              <p className="analytics-formal__meta">Prepared {reportStamp()}. The five activities with the most submitted attempts.</p>
              {(activities?.highest_completion || []).length === 0 ? <p className="analytics-formal__empty">No completed activities yet.</p> : (
                <table className="analytics-formal__table">
                  <thead><tr><th>Rank</th><th>Activity</th><th>Submitted attempts</th></tr></thead>
                  <tbody>
                    {(activities?.highest_completion || []).map((activity, index) => (
                      <tr key={activity.id}><td>{index + 1}</td><td>{activity.title}</td><td>{activity.done_count}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              <footer className="analytics-formal__foot">RESERVANCE · Scores recorded at the time of printing · For academic review</footer>
            </article>
          </article>
          <article className="card-gold-border analytics-print-root" data-print-root>
            <div className="analytics-print-root__actions no-print">
              <h3>Most missed or failed</h3>
              <PrintButton label="Print report" />
            </div>
            {(activities?.most_failed || []).length === 0 ? (
              <p className="analytics-empty">No missed or failed attempts yet.</p>
            ) : (
              <ol>
                {activities.most_failed.map((activity) => (
                  <li key={activity.id}><span>{activity.title}</span><strong>{activity.failed_count} attempts</strong></li>
                ))}
              </ol>
            )}
            <article className="analytics-formal">
              <header className="analytics-formal__mast">
                <p className="analytics-formal__brand">RESERVANCE</p>
                <p className="analytics-formal__office">Program Chair · Academic Report</p>
                <h1>Most Missed or Failed Activities</h1>
              </header>
              <p className="analytics-formal__meta">Prepared {reportStamp()}. A missed attempt was not submitted. A failed attempt did not meet the recorded result.</p>
              {(activities?.most_failed || []).length === 0 ? <p className="analytics-formal__empty">No missed or failed attempts yet.</p> : (
                <table className="analytics-formal__table">
                  <thead><tr><th>Rank</th><th>Activity</th><th>Missed or failed attempts</th></tr></thead>
                  <tbody>
                    {(activities?.most_failed || []).map((activity, index) => (
                      <tr key={activity.id}><td>{index + 1}</td><td>{activity.title}</td><td>{activity.failed_count}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              <footer className="analytics-formal__foot">RESERVANCE · Scores recorded at the time of printing · For academic review</footer>
            </article>
          </article>
          <article className="card-gold-border analytics-print-root" data-print-root>
            <div className="analytics-print-root__actions no-print">
              <h3>Faculty activity</h3>
              <PrintButton label="Print report" />
            </div>
            {(faculty || []).length === 0 ? (
              <p className="analytics-empty">No faculty accounts yet.</p>
            ) : (
              <ol>
                {faculty.map((member) => (
                  <li key={member.name}><span>{member.name}</span><strong>{member.activities_created} created</strong></li>
                ))}
              </ol>
            )}
            <article className="analytics-formal">
              <header className="analytics-formal__mast">
                <p className="analytics-formal__brand">RESERVANCE</p>
                <p className="analytics-formal__office">Program Chair · Academic Report</p>
                <h1>Faculty Activity Report</h1>
              </header>
              <p className="analytics-formal__meta">Prepared {reportStamp()}. Activities created by each faculty account.</p>
              {(faculty || []).length === 0 ? <p className="analytics-formal__empty">No faculty accounts yet.</p> : (
                <table className="analytics-formal__table">
                  <thead><tr><th>Faculty</th><th>Activities created</th></tr></thead>
                  <tbody>
                    {(faculty || []).map((member) => (
                      <tr key={member.name}><td>{member.name}</td><td>{member.activities_created}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              <footer className="analytics-formal__foot">RESERVANCE · Scores recorded at the time of printing · For academic review</footer>
            </article>
          </article>
        </section>
      </div>
    </>
  )
}

function StudentActivityModal({ open, student, detail, loading, error, onClose, showCreator }) {
  const title = student ? `${student.name} — Activity history` : 'Student activity history'

  return (
    <Modal open={open} title={title} onClose={onClose} wide xl>
      {loading && <LoadingScreen compact fullscreen={false} message="Loading activity history…" />}
      {error && <p className="registry-empty">{error}</p>}
      {!loading && !error && detail && (
        <div className="analytics-print-root" data-print-root>
          <div className="analytics-detail__toolbar no-print">
            <p className="analytics-detail__meta">
              {detail.student?.student_profile?.student_number || '—'}
              {' · '}
              {getSectionLabel(detail.student)}
              {' · '}
              {detail.student?.email}
            </p>
            <PrintButton label="Print report" />
          </div>

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
          <article className="analytics-formal">
            <header className="analytics-formal__mast">
              <p className="analytics-formal__brand">RESERVANCE</p>
              <p className="analytics-formal__office">Program Chair · Academic Report</p>
              <h1>Student Performance Report</h1>
              <p className="analytics-formal__kicker">{detail.student?.name}</p>
            </header>
            <p className="analytics-formal__meta">
              Prepared {reportStamp()}
              {' · '}
              {detail.student?.student_profile?.student_number || 'No student number'}
              {' · '}
              {getSectionLabel(detail.student)}
              {' · '}
              {detail.student?.email}
            </p>
            <p>
              Performance {scoreBand(detail.summary?.average_score) || 'No score yet'}.
              Activities taken {detail.summary?.activities_taken ?? 0}.
              Average {formatScore(detail.summary?.average_score)}.
              Highest {formatScore(detail.summary?.highest_score)}.
            </p>
            {detail.records?.length ? (
              <table className="analytics-formal__table">
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
                      <td>{formatActivityType(record.activity?.type)}</td>
                      {showCreator && <td>{record.activity?.creator?.name || '—'}</td>}
                      <td>{String(record.status || '—').replace(/_/g, ' ')}</td>
                      <td>{record.score?.percentage != null ? formatScore(record.score.percentage) : '—'}</td>
                      <td>{record.score?.accuracy != null ? formatScore(record.score.accuracy) : '—'}</td>
                      <td>{formatDate(record.submitted_at || record.started_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="analytics-formal__empty">No activity attempts recorded yet.</p>}
            <footer className="analytics-formal__foot">RESERVANCE · Scores recorded at the time of printing · For academic review</footer>
          </article>
        </div>
      )}
    </Modal>
  )
}

function FilterBar({
  programs, sections, search, programId, sectionId, studentSort, courseSort, sectionSort,
  onSearch, onProgram, onSection, onStudentSort, onCourseSort, onSectionSort,
}) {
  return (
    <div className="student-masterlist__toolbar analytics-filters">
      <div className="form-field student-masterlist__search">
        <label htmlFor="analytics-masterlist-search">Search</label>
        <input
          id="analytics-masterlist-search"
          type="search"
          placeholder="Search name, email, student no., program, or section…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="form-field">
        <label htmlFor="analytics-masterlist-program-filter">Course</label>
        <select id="analytics-masterlist-program-filter" value={programId} onChange={(e) => onProgram(e.target.value)}>
          <option value="">All courses</option>
          {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="analytics-masterlist-section-filter">Section</label>
        <select id="analytics-masterlist-section-filter" value={sectionId} onChange={(e) => onSection(e.target.value)}>
          <option value="">All sections</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {formatSectionLabel(section.program_code || section.program_name, section.year_level, section.name, section.semester)}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="analytics-masterlist-sort">Sort students by</label>
        <select id="analytics-masterlist-sort" value={studentSort} onChange={(e) => onStudentSort(e.target.value)}>
          <option value="score-desc">Highest average score</option>
          <option value="score-asc">Lowest average score</option>
          <option value="name">Name (A–Z)</option>
          <option value="name-desc">Name (Z–A)</option>
          <option value="activities-desc">Most activities taken</option>
          <option value="activities-asc">Fewest activities taken</option>
          <option value="recent">Most recent activity</option>
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="analytics-course-sort">Sort courses by</label>
        <select id="analytics-course-sort" value={courseSort} onChange={(e) => onCourseSort(e.target.value)}>
          {COURSE_SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="analytics-section-sort">Sort sections by</label>
        <select id="analytics-section-sort" value={sectionSort} onChange={(e) => onSectionSort(e.target.value)}>
          {SECTION_SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
    </div>
  )
}

function StudentMasterlist({ students, sortedStudents, paginatedStudents, page, totalPages, rangeStart, rangeEnd, onPage, onSelect }) {
  return (
    <section className="student-masterlist" aria-label="Student masterlist">
      <div className="student-masterlist__head">
        <h3 className="student-masterlist__title">Students</h3>
        <p className="student-masterlist__meta">
          {sortedStudents.length} shown{sortedStudents.length !== students.length ? ` of ${students.length}` : ''}. Open a student for every activity.
        </p>
      </div>
      {students.length === 0 ? (
        <p className="registry-empty">No students registered yet.</p>
      ) : sortedStudents.length === 0 ? (
        <p className="registry-empty">No students match your filters.</p>
      ) : (
        <>
          <ul className="student-masterlist__list">
            {paginatedStudents.map((student) => {
              const band = scoreBand(student.analytics?.average_score) || 'No score yet'
              return (
                <li key={student.id}>
                  <button type="button" className="student-masterlist__item student-masterlist__item--clickable" onClick={() => onSelect(student)}>
                    <div className="student-masterlist__identity">
                      <span className={`student-presence-dot ${student.is_online ? 'student-presence-dot--online' : 'student-presence-dot--offline'}`} aria-hidden="true" />
                      <span className="student-masterlist__name">{student.name}</span>
                    </div>
                    <div className="student-masterlist__details">
                      <span>{student.student_profile?.student_number || '—'}</span>
                      <span>{student.student_profile?.program?.name || '—'}</span>
                      <span>{getSectionLabel(student)}</span>
                    </div>
                    <div className="student-masterlist__analytics">
                      <span>Taken: <strong>{student.analytics?.activities_taken ?? 0}</strong></span>
                      <span>Avg score: <strong>{formatScore(student.analytics?.average_score)}</strong></span>
                      <span>Last activity: <strong>{formatDate(student.analytics?.last_activity_at)}</strong></span>
                      <span>Performance: <strong style={{ color: BAND_STYLE[band].ink }}>{band}</strong></span>
                    </div>
                    <span className="student-masterlist__chevron" aria-hidden="true">›</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {sortedStudents.length > STUDENT_PAGE_SIZE && (
            <nav className="student-masterlist__pagination" aria-label="Student list pages">
              <button type="button" className="section-browser-pagination__btn" onClick={() => onPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</button>
              <p className="section-browser-pagination__status">Page <strong>{page}</strong> of <strong>{totalPages}</strong></p>
              <button type="button" className="section-browser-pagination__btn section-browser-pagination__btn--primary" onClick={() => onPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Next</button>
            </nav>
          )}
          <p className="student-masterlist__count">Showing {rangeStart}–{rangeEnd} of {sortedStudents.length} filtered student(s)</p>
        </>
      )}
    </section>
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
  const [masterlistSort, setMasterlistSort] = useState('score-desc')
  const [courseSort, setCourseSort] = useState('score-desc')
  const [sectionSort, setSectionSort] = useState('score-desc')
  const [analyticsTab, setAnalyticsTab] = useState('performance')
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
      program_code: program.code || program.name,
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

  const reportGroups = useMemo(
    () => buildAnalyticsGroups(filteredStudents, programs, masterlistProgramFilter, masterlistSectionFilter),
    [filteredStudents, programs, masterlistProgramFilter, masterlistSectionFilter],
  )
  const courseGroups = useMemo(
    () => sortAnalyticsRows(reportGroups.courses, courseSort),
    [reportGroups.courses, courseSort],
  )
  const sectionGroups = useMemo(
    () => sortAnalyticsRows(reportGroups.sections, sectionSort),
    [reportGroups.sections, sectionSort],
  )

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
        case 'recent': {
          const time = (student) => {
            const value = student.analytics?.last_activity_at
            const ms = value ? new Date(value).getTime() : 0
            return Number.isFinite(ms) ? ms : 0
          }
          return time(b) - time(a) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        }
        default:
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      }
    })

    return list
  }, [filteredStudents, masterlistSort])

  const masterlistTotalPages = Math.max(1, Math.ceil(sortedStudents.length / STUDENT_PAGE_SIZE))

  const paginatedStudents = useMemo(() => {
    const start = (masterlistPage - 1) * STUDENT_PAGE_SIZE
    return sortedStudents.slice(start, start + STUDENT_PAGE_SIZE)
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
    : (masterlistPage - 1) * STUDENT_PAGE_SIZE + 1
  const masterlistRangeEnd = Math.min(masterlistPage * STUDENT_PAGE_SIZE, sortedStudents.length)

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
        description="Review each course, section, and student. Sort from lowest to highest."
      />

      {isSuperAdmin ? <SuperAdminSummary data={data} /> : <FacultySummary data={data} />}

      {isSuperAdmin && (
        <div className="analytics-stage card-gold-border" data-tab={analyticsTab}>
          <FilterBar
              programs={programs}
              sections={masterlistSections}
              search={masterlistSearch}
              programId={masterlistProgramFilter}
              sectionId={masterlistSectionFilter}
              studentSort={masterlistSort}
              courseSort={courseSort}
              sectionSort={sectionSort}
              onSearch={setMasterlistSearch}
              onProgram={(value) => { setMasterlistProgramFilter(value); setMasterlistSectionFilter('') }}
              onSection={setMasterlistSectionFilter}
              onStudentSort={setMasterlistSort}
              onCourseSort={setCourseSort}
              onSectionSort={setSectionSort}
            />
          <div className="analytics-tabs" role="tablist" aria-label="Analytics views">
            {[
              ['performance', 'Performance'],
              ['courses', 'Courses'],
              ['sections', 'Sections'],
              ['activities', 'Activities'],
              ['students', 'Students'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={analyticsTab === id}
                className={analyticsTab === id ? 'is-active' : ''}
                onClick={() => setAnalyticsTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <DetailedAnalytics
            students={filteredStudents}
            courses={courseGroups}
            sections={sectionGroups}
            courseSort={courseSort}
            sectionSort={sectionSort}
            activities={data.activities}
            faculty={data.faculty}
            onSelect={setSelectedStudent}
          />
          <div className="analytics-panel" data-panel="students">
            <StudentMasterlist
              students={students}
              sortedStudents={sortedStudents}
              paginatedStudents={paginatedStudents}
              page={masterlistPage}
              totalPages={masterlistTotalPages}
              rangeStart={masterlistRangeStart}
              rangeEnd={masterlistRangeEnd}
              onPage={setMasterlistPage}
              onSelect={setSelectedStudent}
            />
          </div>
        </div>
      )}

      {!isSuperAdmin && (
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
                  {formatSectionLabel(section.program_code || section.program_name, section.year_level, section.name, section.semester)}
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
                      <span>
                        Performance: <strong>{scoreBand(student.analytics?.average_score) || 'No score yet'}</strong>
                      </span>
                    </div>
                    <span className="student-masterlist__chevron" aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>

            {sortedStudents.length > STUDENT_PAGE_SIZE && (
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
      )}

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
