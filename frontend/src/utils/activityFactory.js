export const CHOICE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
export const ASSESSMENT_TYPES = [
  { value: 'activity', label: 'Activity' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'exam', label: 'Exam' },
  { value: 'simulation', label: 'Simulation' },
  { value: 'combination', label: 'Combination' },
]

export const COMBINATION_WORKSPACE_STEPS = [
  { id: 'setup', label: 'Setup', hint: 'Title & type' },
  { id: 'questions', label: 'Questions', hint: 'Build items' },
  { id: 'hotel', label: 'Hotel', hint: 'Rooms & rates' },
  { id: 'scenario', label: 'Scenario', hint: 'Briefing & answers' },
  { id: 'audience', label: 'Audience', hint: 'Who receives it' },
  { id: 'schedule', label: 'Schedule', hint: 'Window & publish' },
]

export const SIMULATION_WORKSPACE_STEPS = [
  { id: 'setup', label: 'Setup', hint: 'Title & type' },
  { id: 'hotel', label: 'Hotel', hint: 'Rooms & rates' },
  { id: 'scenario', label: 'Scenario', hint: 'Briefing & answers' },
  { id: 'audience', label: 'Audience', hint: 'Who receives it' },
  { id: 'schedule', label: 'Schedule', hint: 'Window & publish' },
]

export const WORKSPACE_STEPS = [
  { id: 'setup', label: 'Setup', hint: 'Title & type' },
  { id: 'questions', label: 'Questions', hint: 'Build items' },
  { id: 'audience', label: 'Audience', hint: 'Who receives it' },
  { id: 'schedule', label: 'Schedule', hint: 'Window & publish' },
]

export const STATUS_META = {
  draft: { label: 'Draft', tone: 'muted' },
  published: { label: 'Published', tone: 'info' },
  active: { label: 'Open', tone: 'success' },
  closed: { label: 'Closed', tone: 'danger' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  archived: { label: 'Archived', tone: 'muted' },
}

export function emptyQuestion() {
  return {
    type: 'mcq',
    body: '',
    explanation: '',
    timer_seconds: '',
    choices: defaultChoices(),
    metadata: {
      correct_answer: '',
      alternatives: [''],
      manual_checking: false,
      allow_multiple_correct: false,
      image_path: '',
      image_url: '',
    },
  }
}

export function defaultChoices(count = 4) {
  return CHOICE_LETTERS.slice(0, count).map((label, i) => ({
    label,
    text: '',
    is_correct: i === 0,
  }))
}

export function relabelChoices(choices) {
  return choices.map((c, i) => ({ ...c, label: CHOICE_LETTERS[i] }))
}

export function addChoice(choices) {
  if (choices.length >= 26) return choices
  return relabelChoices([...choices, { label: '', text: '', is_correct: false }])
}

export function removeChoice(choices, index) {
  if (choices.length <= 2) return choices
  const next = choices.filter((_, i) => i !== index)
  const hasCorrect = next.some((c) => c.is_correct)
  if (!hasCorrect && next.length) next[0] = { ...next[0], is_correct: true }
  return relabelChoices(next)
}

export function knownAnswer(question) {
  const written = String(question?.metadata?.correct_answer || '').trim()
  if (written) return written
  const correct = (question?.choices || []).find((choice) => choice.is_correct && String(choice.text || '').trim())
  return correct ? String(correct.text).trim() : ''
}

export function withQuestionType(question, type) {
  const answer = knownAnswer(question)
  const metadata = {
    ...(question.metadata || {}),
    alternatives: question.metadata?.alternatives?.length ? question.metadata.alternatives : [''],
  }

  if (type === 'identification') {
    return {
      ...question,
      type: 'identification',
      metadata: { ...metadata, correct_answer: answer },
    }
  }

  let choices = (question.choices || []).map((choice) => ({ ...choice }))
  const hasText = choices.some((choice) => String(choice.text || '').trim())
  if (!hasText) {
    choices = defaultChoices()
    if (answer) choices[0] = { ...choices[0], text: answer, is_correct: true }
  } else if (answer) {
    const match = choices.findIndex((choice) => String(choice.text || '').trim().toLowerCase() === answer.toLowerCase())
    if (match === -1) {
      choices = [{ label: 'A', text: answer, is_correct: true }, ...choices.map((choice) => ({ ...choice, is_correct: false }))]
    }
    choices = choices.map((choice) => ({
      ...choice,
      is_correct: String(choice.text || '').trim().toLowerCase() === answer.toLowerCase(),
    }))
    if (!choices.some((choice) => choice.is_correct) && choices.length) {
      choices[0] = { ...choices[0], text: answer, is_correct: true }
    }
  }
  while (choices.length < 4) {
    choices.push({ label: '', text: '', is_correct: false })
  }

  return {
    ...question,
    type: 'mcq',
    choices: relabelChoices(choices),
    metadata: { ...metadata, correct_answer: '' },
  }
}

export function createQuestions(count) {
  const total = Math.max(1, Math.min(100, Number(count) || 1))
  return Array.from({ length: total }, () => emptyQuestion())
}

export function normalizeIdentification(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function validateQuestion(question, index) {
  const errors = []
  const num = index + 1
  const meta = question.metadata || {}
  const manual = Boolean(meta.manual_checking)

  if (!String(question.body || '').trim()) {
    errors.push('Question text is required.')
  }

  if (question.timer_seconds !== '' && question.timer_seconds != null) {
    const secs = Number(question.timer_seconds)
    if (Number.isNaN(secs) || secs < 5) {
      errors.push('Minimum 5 seconds, or leave empty.')
    }
  }

  if (question.type === 'mcq') {
    const choices = question.choices || []
    if (choices.length < 2) errors.push('At least two answer choices are required.')
    if (choices.some((c) => !String(c.text || '').trim())) {
      errors.push('Answer choices cannot be empty.')
    }
    if (!manual && !choices.some((c) => c.is_correct)) {
      errors.push('Select at least one correct answer or enable manual checking.')
    }
  }

  if (question.type === 'identification') {
    const accepted = [
      meta.correct_answer,
      ...(meta.alternatives || []),
    ].filter((v) => String(v || '').trim())
    if (!manual && !accepted.length) {
      errors.push('Add at least one accepted answer or enable manual checking.')
    }
  }

  return errors.length ? { index, num, errors } : null
}

export function validateAssessment(form, targeting) {
  const questionErrors = (form.questions || [])
    .map((q, i) => validateQuestion(q, i))
    .filter(Boolean)

  const fieldErrors = {}
  if (!String(form.title || '').trim()) fieldErrors.title = 'Activity title is required.'
  if (!form.type) fieldErrors.type = 'Assessment type is required.'
  if (!form.questions?.length) fieldErrors.questions = 'Add at least one question.'

  if (form.starts_at && form.ends_at && new Date(form.ends_at) < new Date(form.starts_at)) {
    fieldErrors.ends_at = 'End time cannot be before start time.'
  }

  const assignmentErrors = validateTargeting(targeting)

  return { questionErrors, fieldErrors, assignmentErrors, valid: !questionErrors.length && !Object.keys(fieldErrors).length && !assignmentErrors.length }
}

export function validateTargeting(targeting) {
  if (targeting.mode === 'sections' && !targeting.sectionIds.length) {
    return ['Select at least one section or choose a different audience option.']
  }
  if (targeting.mode === 'students' && !targeting.studentIds.length) {
    return ['Select at least one student or choose a different audience option.']
  }
  return []
}

export function buildAssignments(targeting) {
  if (targeting.mode === 'all') return [{ scope: 'all' }]
  if (targeting.mode === 'sections') {
    return targeting.sectionIds.map((section_id) => ({ scope: 'section', section_id }))
  }
  if (targeting.mode === 'students') {
    return targeting.studentIds.map((student_user_id) => ({ scope: 'student', student_user_id }))
  }
  return []
}

export function assignmentsToTargeting(assignments = []) {
  if (!assignments.length) {
    return { mode: 'all', sectionIds: [], studentIds: [] }
  }
  if (assignments.some((a) => a.scope === 'all')) {
    return { mode: 'all', sectionIds: [], studentIds: [] }
  }
  const sectionIds = assignments.filter((a) => a.scope === 'section').map((a) => a.section_id)
  const studentIds = assignments.filter((a) => a.scope === 'student').map((a) => a.student_user_id)
  if (studentIds.length && !sectionIds.length) {
    return { mode: 'students', sectionIds: [], studentIds }
  }
  return { mode: 'sections', sectionIds, studentIds: [] }
}

export function toApiPayload(form, targeting) {
  return {
    title: form.title.trim(),
    description: form.description || '',
    instructions: form.instructions || '',
    type: form.type,
    status: 'draft',
    time_limit_minutes: form.time_limit_minutes ? Number(form.time_limit_minutes) : null,
    starts_at: form.starts_at || null,
    ends_at: form.ends_at || null,
    assignments: buildAssignments(targeting),
    questions: (form.questions || []).map((q) => ({
      type: q.type,
      body: q.body,
      explanation: q.explanation || '',
      timer_seconds: q.timer_seconds === '' || q.timer_seconds == null ? null : Number(q.timer_seconds),
      metadata: {
        correct_answer: q.metadata?.correct_answer || '',
        alternatives: (q.metadata?.alternatives || []).filter((v) => String(v || '').trim()),
        manual_checking: Boolean(q.metadata?.manual_checking),
        allow_multiple_correct: Boolean(q.metadata?.allow_multiple_correct),
        image_path: q.metadata?.image_path || '',
        image_url: q.metadata?.image_url || '',
      },
      choices: q.type === 'mcq'
        ? (q.choices || []).map((c) => ({
          label: c.label,
          text: c.text,
          is_correct: Boolean(c.is_correct),
        }))
        : [],
    })),
  }
}

export function toDatetimeLocal(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function activityToForm(activity) {
  return {
    title: activity.title || '',
    description: activity.description || '',
    instructions: activity.instructions || '',
    type: activity.type || 'quiz',
    time_limit_minutes: activity.time_limit_minutes ?? '',
    starts_at: toDatetimeLocal(activity.starts_at),
    ends_at: toDatetimeLocal(activity.ends_at),
    questions: (activity.questions || []).map((q) => ({
      type: q.type,
      body: q.body || '',
      explanation: q.explanation || '',
      timer_seconds: q.timer_seconds ?? '',
      choices: q.type === 'mcq'
        ? relabelChoices((q.choices || []).map((c) => ({
          label: c.label,
          text: c.text || '',
          is_correct: Boolean(c.is_correct),
        })))
        : defaultChoices(),
      metadata: {
        correct_answer: q.metadata?.correct_answer || '',
        alternatives: q.metadata?.alternatives?.length ? q.metadata.alternatives : [''],
        manual_checking: Boolean(q.metadata?.manual_checking),
        allow_multiple_correct: Boolean(q.metadata?.allow_multiple_correct),
        image_path: q.metadata?.image_path || '',
        image_url: q.metadata?.image_url || '',
      },
    })),
  }
}

export function formatSectionLabel(section, program) {
  const sem = section.semester === 1 ? 'FIRST SEM' : section.semester === 2 ? 'SECOND SEM' : `SEM ${section.semester}`
  return `${program?.name || ''} ${section.year_level}-${section.name} | ${sem}`.trim()
}

export function audienceSummary(activity, programs = []) {
  const assignments = activity.assignments || []
  if (!assignments.length) return 'Not configured'
  if (assignments.some((a) => a.scope === 'all')) return 'All sections'
  const sections = assignments.filter((a) => a.scope === 'section')
  const students = assignments.filter((a) => a.scope === 'student')
  if (students.length) return `${students.length} student${students.length === 1 ? '' : 's'}`
  if (sections.length) {
    const labels = sections.map((a) => {
      for (const p of programs) {
        const s = p.sections?.find((sec) => sec.id === a.section_id)
        if (s) return formatSectionLabel(s, p)
      }
      return `Section #${a.section_id}`
    })
    return labels.slice(0, 2).join(', ') + (labels.length > 2 ? ` +${labels.length - 2}` : '')
  }
  return 'Custom audience'
}

export function emptySimulationConfig() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const arrival = tomorrow.toISOString().slice(0, 10)

  return {
    hotel_name: 'RESERVANCE Grand Hotel',
    room_types: [
      { code: 'STD', label: 'Standard', max_guests: 2, rates: { rack: 2500, discount: 2000 } },
      { code: 'DLX', label: 'Deluxe', max_guests: 3, rates: { rack: 3500, discount: 2800 } },
    ],
    rooms: [
      { number: '101', room_type: 'STD', status: 'available' },
      { number: '102', room_type: 'STD', status: 'available' },
      { number: '201', room_type: 'DLX', status: 'available' },
      { number: '202', room_type: 'DLX', status: 'available' },
    ],
    scenario: {
      briefing: 'A guest needs a Deluxe room for 2 nights. Complete reservation, check-in, and check-out.',
      guest: { last_name: 'Santos', first_name: 'Maria', phone: '09171234567' },
      reservation: {
        arrival_date: arrival,
        nights: 2,
        guests: 2,
        room_type: 'DLX',
        room_number: '202',
        rate_type: 'rack',
      },
      check_in: { required: true },
      check_out: { required: true, folio_total: 7000, payment_type: 'cash', amount_tendered: 7000 },
    },
    grading: {
      criteria: [
        { key: 'guest_details', label: 'Guest details correct', points: 15 },
        { key: 'reservation', label: 'Reservation correct', points: 35 },
        { key: 'check_in', label: 'Check-in completed', points: 25 },
        { key: 'check_out', label: 'Check-out completed', points: 25 },
      ],
    },
  }
}

export function validateSimulation(form, targeting) {
  const fieldErrors = {}
  const config = form.simulation_config || {}

  if (!String(form.title || '').trim()) fieldErrors.title = 'Activity title is required.'
  if (!config.rooms?.length) fieldErrors.rooms = 'Add at least one room.'
  if (!config.room_types?.length) fieldErrors.room_types = 'Add at least one room type.'

  const guest = config.scenario?.guest || {}
  if (!String(guest.last_name || '').trim() || !String(guest.first_name || '').trim()) {
    fieldErrors.guest = 'Scenario guest name is required.'
  }

  const res = config.scenario?.reservation || {}
  if (!String(res.room_number || '').trim() || !String(res.room_type || '').trim()) {
    fieldErrors.reservation = 'Scenario room type and room number are required.'
  }

  if (form.starts_at && form.ends_at && new Date(form.ends_at) < new Date(form.starts_at)) {
    fieldErrors.ends_at = 'End time cannot be before start time.'
  }

  const assignmentErrors = validateTargeting(targeting)
  const valid = !Object.keys(fieldErrors).length && !assignmentErrors.length

  return { fieldErrors, assignmentErrors, valid, questionErrors: [] }
}

export function validateCombination(form, targeting) {
  const assessment = validateAssessment(form, targeting)
  const simulation = validateSimulation(form, targeting)
  return {
    questionErrors: assessment.questionErrors,
    fieldErrors: { ...assessment.fieldErrors, ...simulation.fieldErrors },
    assignmentErrors: assessment.assignmentErrors.length ? assessment.assignmentErrors : simulation.assignmentErrors,
    valid: assessment.valid && simulation.valid,
  }
}

export function combinationToApiPayload(form, targeting) {
  return {
    ...toApiPayload(form, targeting),
    type: 'combination',
    simulation_config: form.simulation_config,
  }
}

export function combinationActivityToForm(activity) {
  return {
    ...activityToForm(activity),
    type: 'combination',
    simulation_config: activity.simulation_config || emptySimulationConfig(),
  }
}

export function simulationToApiPayload(form, targeting) {
  return {
    title: form.title.trim(),
    description: form.description || '',
    instructions: form.instructions || '',
    type: 'simulation',
    status: 'draft',
    time_limit_minutes: form.time_limit_minutes ? Number(form.time_limit_minutes) : null,
    starts_at: form.starts_at || null,
    ends_at: form.ends_at || null,
    assignments: buildAssignments(targeting),
    simulation_config: form.simulation_config,
    questions: [],
  }
}

export function simulationActivityToForm(activity) {
  return {
    title: activity.title || '',
    description: activity.description || '',
    instructions: activity.instructions || '',
    type: 'simulation',
    time_limit_minutes: activity.time_limit_minutes ?? '',
    starts_at: toDatetimeLocal(activity.starts_at),
    ends_at: toDatetimeLocal(activity.ends_at),
    simulation_config: activity.simulation_config || emptySimulationConfig(),
    questions: [],
  }
}
