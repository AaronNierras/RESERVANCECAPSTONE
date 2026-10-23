import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import client from '../../api/client'
import { formatSectionLabel } from '../../utils/academic'
import { formatShare, performanceDistribution, sortAnalyticsRows } from '../../utils/dashboardAnalytics'

function averageOf(scoreTotal, scoreCount) {
  return scoreCount ? scoreTotal / scoreCount : null
}

function formatAverage(value) {
  return value === null ? 'No score yet' : `${value.toFixed(1)}%`
}

function ChartRows({ rows, maxStudents }) {
  return (
    <div className="dash-chart">
      {rows.map((row) => (
        <div key={row.key} className="dash-chart__row">
          <div className="dash-chart__label">
            <span className="dash-chart__name">{row.label}</span>
            {row.detail && <span className="dash-chart__detail">{row.detail}</span>}
          </div>
          <div className="dash-chart__meters">
            <div className="dash-chart__meter">
              <span className="dash-chart__meter-name">Average score</span>
              <div className="dash-chart__track" role="img" aria-label={`${row.label} average score ${formatAverage(row.average)}`}>
                <div className="dash-chart__bar dash-chart__bar--score" style={{ width: `${row.average ?? 0}%` }} />
              </div>
              <span className="dash-chart__value">{formatAverage(row.average)}</span>
            </div>
            <div className="dash-chart__meter">
              <span className="dash-chart__meter-name">Students</span>
              <div className="dash-chart__track" role="img" aria-label={`${row.label} has ${row.students} students`}>
                <div
                  className="dash-chart__bar dash-chart__bar--students"
                  style={{ width: `${maxStudents ? (row.students / maxStudents) * 100 : 0}%` }}
                />
              </div>
              <span className="dash-chart__value">{row.students}</span>
            </div>
            <div className="dash-chart__meter">
              <span className="dash-chart__meter-name">Activities taken</span>
              <div className="dash-chart__track" role="img" aria-label={`${row.label} has ${row.activities} activities taken`}>
                <div
                  className="dash-chart__bar dash-chart__bar--activities"
                  style={{ width: `${row.maxActivities ? (row.activities / row.maxActivities) * 100 : 0}%` }}
                />
              </div>
              <span className="dash-chart__value">{row.activities}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function PerformanceTooltip({ active, payload }) {
  const item = payload?.[0]?.payload
  if (!active || !item) return null
  const noun = item.count === 1 ? 'student' : 'students'
  return (
    <div className="dash-pie__tip">
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
    <article className="dash-pie" aria-label="Student Performance Distribution">
      <h3>Student Performance Distribution</h3>
      <p className="dash-pie__note">Counted only when a student already has an average score.</p>
      {distribution.scored === 0 ? (
        <p className="dash-pie__empty">No student performance data available</p>
      ) : (
        <div className="dash-pie__body">
          <div className="dash-pie__chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slices} dataKey="count" nameKey="label" innerRadius={48} outerRadius={74} paddingAngle={2} stroke="#fff">
                  {slices.map((slice) => <Cell key={slice.key} fill={slice.color} />)}
                </Pie>
                <Tooltip content={<PerformanceTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <p className="dash-pie__center">
              <strong>{distribution.scored}</strong>
              <span>{distribution.scored === 1 ? 'student' : 'students'}</span>
            </p>
          </div>
          <ul className="dash-pie__legend">
            {distribution.bands.map((band) => (
              <li key={band.key}>
                <span><i className="dash-chart__swatch" style={{ background: band.color }} /> {band.label} <em>{band.range}</em></span>
                <strong>{band.count} · {formatShare(band.percent)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
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

export default function DashboardCourseAnalytics() {
  const [students, setStudents] = useState([])
  const [programs, setPrograms] = useState([])
  const [programId, setProgramId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [courseSort, setCourseSort] = useState('score-desc')
  const [sectionSort, setSectionSort] = useState('score-desc')

  useEffect(() => {
    client.get('/super-admin/analytics').then((res) => setStudents(res.data.students || [])).catch(() => {})
    client.get('/super-admin/programs').then((res) => setPrograms(res.data.programs || [])).catch(() => {})
  }, [])

  const sections = useMemo(
    () => programs.flatMap((program) => (program.sections || []).map((section) => ({
      ...section,
      program_id: program.id,
      label: formatSectionLabel(program.code || program.name, section.year_level, section.name, section.semester),
    }))),
    [programs],
  )

  const filteredStudents = useMemo(() => students.filter((student) => {
    const profile = student.student_profile
    if (programId && String(profile?.program?.id) !== String(programId)) return false
    if (sectionId && String(profile?.section?.id) !== String(sectionId)) return false
    return true
  }), [students, programId, sectionId])

  const { courseRows, sectionRows, summary } = useMemo(() => {
    const courses = new Map()
    const sectionBuckets = new Map()

    programs.forEach((program) => {
      if (programId && String(program.id) !== String(programId)) return
      courses.set(program.id, {
        key: `course-${program.id}`,
        label: program.name,
        detail: '',
        students: 0,
        activities: 0,
        scoreTotal: 0,
        scoreCount: 0,
      })
      ;(program.sections || []).forEach((section) => {
        if (sectionId && String(section.id) !== String(sectionId)) return
        sectionBuckets.set(section.id, {
          key: `section-${section.id}`,
          label: formatSectionLabel(program.code || program.name, section.year_level, section.name, section.semester),
          detail: program.name,
          students: 0,
          activities: 0,
          scoreTotal: 0,
          scoreCount: 0,
        })
      })
    })
    let scoreTotal = 0
    let scoreCount = 0
    let activities = 0

    filteredStudents.forEach((student) => {
      const profile = student.student_profile
      const program = profile?.program
      const section = profile?.section
      const taken = Number(student.analytics?.activities_taken || 0)
      const score = student.analytics?.average_score
      activities += taken
      if (score !== null && score !== undefined) {
        scoreTotal += Number(score)
        scoreCount += 1
      }

      const courseKey = program?.id || 'none'
      const course = courses.get(courseKey) || {
        key: `course-${courseKey}`,
        label: program?.name || 'Waiting for a section',
        detail: '',
        students: 0,
        activities: 0,
        scoreTotal: 0,
        scoreCount: 0,
      }
      course.students += 1
      course.activities += taken
      if (score !== null && score !== undefined) {
        course.scoreTotal += Number(score)
        course.scoreCount += 1
      }
      courses.set(courseKey, course)

      const sectionKey = section?.id || `none-${courseKey}`
      const sectionRow = sectionBuckets.get(sectionKey) || {
        key: `section-${sectionKey}`,
        label: section
          ? formatSectionLabel(program?.code || program?.name, section.year_level, section.name, section.semester)
          : 'Unassigned',
        detail: program?.name || 'Waiting for a section',
        students: 0,
        activities: 0,
        scoreTotal: 0,
        scoreCount: 0,
      }
      sectionRow.students += 1
      sectionRow.activities += taken
      if (score !== null && score !== undefined) {
        sectionRow.scoreTotal += Number(score)
        sectionRow.scoreCount += 1
      }
      sectionBuckets.set(sectionKey, sectionRow)
    })

    const finish = (row) => ({
      ...row,
      average: averageOf(row.scoreTotal, row.scoreCount),
    })

    const courseList = sortAnalyticsRows([...courses.values()].map(finish), courseSort)
    const sectionList = sortAnalyticsRows([...sectionBuckets.values()].map(finish), sectionSort)
    const maxActivities = Math.max(1, ...courseList.map((row) => row.activities), ...sectionList.map((row) => row.activities))

    return {
      courseRows: courseList.map((row) => ({ ...row, maxActivities })),
      sectionRows: sectionList.map((row) => ({ ...row, maxActivities })),
      summary: {
        students: filteredStudents.length,
        courses: courseList.length,
        sections: sectionList.length,
        activities,
        average: averageOf(scoreTotal, scoreCount),
      },
    }
  }, [filteredStudents, programs, programId, sectionId, courseSort, sectionSort])

  const maxCourseStudents = Math.max(1, ...courseRows.map((row) => row.students))
  const maxSectionStudents = Math.max(1, ...sectionRows.map((row) => row.students))

  return (
    <section className="dash-analytics card-gold-border" aria-label="Course analytics">
      <header className="dash-analytics__head">
        <h2 className="dash-section-title">Data analytics</h2>
        <p>Compare every course and section by average score, class size, and activities taken.</p>
      </header>

      <div className="dash-analytics__stats">
        <p><span>Students</span><strong>{summary.students}</strong></p>
        <p><span>Courses</span><strong>{summary.courses}</strong></p>
        <p><span>Sections</span><strong>{summary.sections}</strong></p>
        <p><span>Overall average</span><strong>{formatAverage(summary.average)}</strong></p>
        <p><span>Activities taken</span><strong>{summary.activities}</strong></p>
      </div>

      <div className="dash-analytics__split">
        <PerformancePie students={filteredStudents} />
        <div className="dash-analytics__filters">
          <h3>Filter and sort</h3>
          <p>These choices update the pie chart and both lists.</p>
          <div className="form-field">
            <label htmlFor="dash-course">Course</label>
            <select id="dash-course" value={programId} onChange={(e) => { setProgramId(e.target.value); setSectionId('') }}>
              <option value="">All courses</option>
              {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="dash-section">Section</label>
            <select id="dash-section" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">All sections</option>
              {sections.filter((section) => !programId || String(section.program_id) === String(programId)).map((section) => (
                <option key={section.id} value={section.id}>{section.label}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="dash-sort-courses">Sort courses by</label>
            <select id="dash-sort-courses" value={courseSort} onChange={(e) => setCourseSort(e.target.value)}>
              {COURSE_SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="dash-sort-sections">Sort sections by</label>
            <select id="dash-sort-sections" value={sectionSort} onChange={(e) => setSectionSort(e.target.value)}>
              {SECTION_SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {courseRows.length === 0 && sectionRows.length === 0 ? (
        <p className="registry-empty">No course results for this filter.</p>
      ) : (
        <div className="dash-analytics__charts">
          <article className="dash-analytics__panel">
            <div className="dash-analytics__panel-head">
              <h3>Courses</h3>
              <div className="dash-analytics__legend">
                <span><i className="dash-chart__swatch dash-chart__swatch--score" /> Score</span>
                <span><i className="dash-chart__swatch dash-chart__swatch--students" /> Students</span>
                <span><i className="dash-chart__swatch dash-chart__swatch--activities" /> Activities</span>
              </div>
            </div>
            <ChartRows rows={courseRows} maxStudents={maxCourseStudents} />
          </article>
          <article className="dash-analytics__panel">
            <div className="dash-analytics__panel-head">
              <h3>Sections</h3>
              <div className="dash-analytics__legend">
                <span><i className="dash-chart__swatch dash-chart__swatch--score" /> Score</span>
                <span><i className="dash-chart__swatch dash-chart__swatch--students" /> Students</span>
                <span><i className="dash-chart__swatch dash-chart__swatch--activities" /> Activities</span>
              </div>
            </div>
            <ChartRows rows={sectionRows} maxStudents={maxSectionStudents} />
          </article>
        </div>
      )}
    </section>
  )
}
