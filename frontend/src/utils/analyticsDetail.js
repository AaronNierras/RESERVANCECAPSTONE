import { formatSectionLabel } from './academic'

export function scoreBand(score) {
  if (score === null || score === undefined || score === '') return null
  const value = Number(score)
  if (!Number.isFinite(value)) return null
  if (value >= 90) return 'Excellent'
  if (value >= 80) return 'Good'
  if (value >= 75) return 'Satisfactory'
  return 'Needs Improvement'
}

function emptySummary() {
  return {
    students: 0,
    scored: 0,
    activities: 0,
    scoreTotal: 0,
    highest: null,
    lowest: null,
    bands: { Excellent: 0, Good: 0, Satisfactory: 0, 'Needs Improvement': 0 },
    people: [],
  }
}

function addStudent(summary, student) {
  const score = student.analytics?.average_score
  const numeric = score === null || score === undefined || score === '' ? null : Number(score)
  const hasScore = Number.isFinite(numeric)
  const band = scoreBand(numeric)
  summary.students += 1
  summary.activities += Number(student.analytics?.activities_taken || 0)
  if (hasScore) {
    summary.scored += 1
    summary.scoreTotal += numeric
    summary.bands[band] += 1
    if (!summary.highest || numeric > summary.highest.score) {
      summary.highest = { name: student.name, score: numeric }
    }
    if (!summary.lowest || numeric < summary.lowest.score) {
      summary.lowest = { name: student.name, score: numeric }
    }
  }
  summary.people.push(student)
}

function finish(summary) {
  return {
    ...summary,
    average: summary.scored ? summary.scoreTotal / summary.scored : null,
  }
}

export function buildAnalyticsGroups(students, programs, programId, sectionId) {
  const courses = new Map()
  const sections = new Map()

  programs.forEach((program) => {
    if (programId && String(program.id) !== String(programId)) return
    courses.set(String(program.id), {
      key: `course-${program.id}`,
      label: program.name,
      detail: '',
      ...emptySummary(),
    })
    ;(program.sections || []).forEach((section) => {
      if (sectionId && String(section.id) !== String(sectionId)) return
      sections.set(String(section.id), {
        key: `section-${section.id}`,
        label: formatSectionLabel(program.code || program.name, section.year_level, section.name, section.semester),
        detail: program.name,
        ...emptySummary(),
      })
    })
  })

  students.forEach((student) => {
    const profile = student.student_profile
    const program = profile?.program
    const section = profile?.section
    const courseKey = program?.id ? String(program.id) : 'none'
    if (!courses.has(courseKey)) {
      courses.set(courseKey, {
        key: `course-${courseKey}`,
        label: program?.name || 'Waiting for a section',
        detail: '',
        ...emptySummary(),
      })
    }
    addStudent(courses.get(courseKey), student)

    const sectionKey = section?.id ? String(section.id) : `none-${courseKey}`
    if (!sections.has(sectionKey)) {
      sections.set(sectionKey, {
        key: `section-${sectionKey}`,
        label: section
          ? formatSectionLabel(program?.code || program?.name, section.year_level, section.name, section.semester)
          : 'Unassigned',
        detail: program?.name || 'Waiting for a section',
        ...emptySummary(),
      })
    }
    addStudent(sections.get(sectionKey), student)
  })

  return {
    courses: [...courses.values()].map(finish),
    sections: [...sections.values()].map(finish),
  }
}
