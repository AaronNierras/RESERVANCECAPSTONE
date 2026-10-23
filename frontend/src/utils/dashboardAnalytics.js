export const PERFORMANCE_BANDS = [
  { key: 'excellent', label: 'Excellent', range: '90–100%', color: '#ffb736', ink: '#d29528' },
  { key: 'good', label: 'Good', range: '80–89%', color: '#d29528', ink: '#d29528' },
  { key: 'satisfactory', label: 'Satisfactory', range: '75–79%', color: '#712c83', ink: '#712c83' },
  { key: 'needs', label: 'Needs Improvement', range: 'Below 75%', color: '#2e0046', ink: '#2e0046' },
]

export function formatShare(percent) {
  if (!Number.isFinite(percent) || percent <= 0) return '0%'
  const rounded = Math.round(percent * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`
}

export function performanceDistribution(students) {
  const counts = Object.fromEntries(PERFORMANCE_BANDS.map((band) => [band.key, 0]))
  let scored = 0

  students.forEach((student) => {
    const raw = student?.analytics?.average_score
    if (raw === null || raw === undefined || raw === '') return
    const score = Number(raw)
    if (!Number.isFinite(score)) return
    scored += 1
    if (score >= 90) counts.excellent += 1
    else if (score >= 80) counts.good += 1
    else if (score >= 75) counts.satisfactory += 1
    else counts.needs += 1
  })

  return {
    scored,
    bands: PERFORMANCE_BANDS.map((band) => {
      const count = counts[band.key]
      const percent = scored > 0 ? (count / scored) * 100 : 0
      return { ...band, count, percent }
    }),
  }
}

export function sortAnalyticsRows(rows, sort) {
  const list = [...rows]
  list.sort((a, b) => {
    const name = String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' })
    if (sort === 'name-asc') return name
    if (sort === 'name-desc') return String(b.label).localeCompare(String(a.label), undefined, { sensitivity: 'base' })
    if (sort === 'students-desc') return b.students - a.students || name
    if (sort === 'students-asc') return a.students - b.students || name
    if (sort === 'activities-desc') return b.activities - a.activities || name
    if (sort === 'activities-asc') return a.activities - b.activities || name
    if (sort === 'score-asc') return (a.average ?? Number.POSITIVE_INFINITY) - (b.average ?? Number.POSITIVE_INFINITY) || name
    return (b.average ?? Number.NEGATIVE_INFINITY) - (a.average ?? Number.NEGATIVE_INFINITY) || name
  })
  return list
}
