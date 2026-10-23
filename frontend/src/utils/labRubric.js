export const PASSING_PERCENT = 75

export function ratingLabel(rating) {
  if (rating === 'competent') return 'Competent'
  if (rating === 'not_yet_competent') return 'Not Yet Competent'
  if (rating === 'in_progress') return 'In progress'
  return 'Not scored'
}

export function evaluateLabMarks(rubric, marks) {
  const activities = []
  let earned = 0
  let allScored = true
  let allPassed = true

  for (const activity of rubric?.activities || []) {
    const input = marks?.[activity.key] || {}
    const criteria = []
    let activityEarned = 0
    let complete = true

    for (const criterion of rubric.criteria || []) {
      const max = activity.criteria[criterion.key]
      const raw = input[criterion.key]
      if (raw === null || raw === undefined || raw === '') {
        complete = false
        criteria.push({ key: criterion.key, earned: null, points: max })
        continue
      }
      const value = Math.round(Number(raw) * 100) / 100
      activityEarned += value
      criteria.push({ key: criterion.key, earned: value, points: max })
    }

    let rating = 'not_scored'
    let percent = null
    if (complete) {
      const passing = (activity.points * PASSING_PERCENT) / 100
      const passed = activityEarned + 0.0001 >= passing
      rating = passed ? 'competent' : 'not_yet_competent'
      percent = Math.round((activityEarned / activity.points) * 10000) / 100
      earned += activityEarned
      if (!passed) allPassed = false
    } else {
      allScored = false
    }

    activities.push({
      key: activity.key,
      earned: complete ? Math.round(activityEarned * 100) / 100 : null,
      points: activity.points,
      percent,
      rating,
      passing_points: Math.round(activity.points * PASSING_PERCENT) / 100,
      criteria,
      note: String(input.note || '').trim(),
    })
  }

  const total = allScored ? Math.round(earned * 100) / 100 : null
  return {
    activities,
    earned: total,
    points: 100,
    percentage: total,
    rating: allScored ? (allPassed ? 'competent' : 'not_yet_competent') : 'in_progress',
    passing_points: 75,
  }
}

export function emptyMarks(rubric, record) {
  const marks = {}
  for (const activity of rubric?.activities || []) {
    const saved = record?.marks?.[activity.key] || {}
    marks[activity.key] = {
      process: saved.process ?? '',
      accuracy: saved.accuracy ?? '',
      communication: saved.communication ?? '',
      professionalism: saved.professionalism ?? '',
      note: saved.note || '',
    }
  }
  return marks
}
