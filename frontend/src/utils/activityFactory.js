import { MAX_SCENARIOS, defaultScenarioScoring, normalizeScenarioRows } from './labScenarios.js'

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
  } else if (String(question.body).trim().length > 2000) {
    errors.push('Question text must be 2,000 characters or fewer.')
  }

  if (String(question.explanation || '').trim().length > 2000) {
    errors.push('The explanation must be 2,000 characters or fewer.')
  }

  if (question.timer_seconds !== '' && question.timer_seconds != null) {
    const secs = Number(question.timer_seconds)
    if (!Number.isInteger(secs) || secs < 5 || secs > 3600) {
      errors.push('The timer must be a whole number from 5 to 3,600 seconds, or left empty.')
    }
  }

  if (question.type === 'mcq') {
    const choices = question.choices || []
    if (choices.length < 2) errors.push('At least two answer choices are required.')
    if (choices.length > 8) errors.push('Use no more than eight answer choices.')
    if (choices.some((c) => !String(c.text || '').trim())) {
      errors.push('Answer choices cannot be empty.')
    }
    if (choices.some((c) => String(c.text || '').trim().length > 500)) {
      errors.push('Each answer choice must be 500 characters or fewer.')
    }
    const texts = choices.map((c) => String(c.text || '').trim().toLowerCase()).filter(Boolean)
    if (new Set(texts).size !== texts.length) {
      errors.push('Answer choices must be different from each other.')
    }
    const correct = choices.filter((c) => c.is_correct).length
    if (!manual && correct === 0) {
      errors.push('Select at least one correct answer or enable manual checking.')
    }
    if (!manual && !meta.allow_multiple_correct && correct > 1) {
      errors.push('Select one correct answer, or allow more than one correct answer.')
    }
  }

  if (question.type === 'identification') {
    const accepted = [
      meta.correct_answer,
      ...(meta.alternatives || []),
    ].map((value) => String(value || '').trim()).filter(Boolean)
    if (!manual && !accepted.length) {
      errors.push('Add at least one accepted answer or enable manual checking.')
    }
    if (accepted.length > 11) {
      errors.push('Use no more than 10 alternative answers.')
    }
    if (accepted.some((value) => value.length > 300)) {
      errors.push('Each accepted answer must be 300 characters or fewer.')
    }
    const folded = accepted.map((value) => value.toLowerCase())
    if (new Set(folded).size !== folded.length) {
      errors.push('Accepted answers must be different from each other.')
    }
  }

  return errors.length ? { index, num, errors } : null
}

export function validateAssessment(form, targeting, context = {}) {
  const questionErrors = (form.questions || [])
    .map((q, i) => validateQuestion(q, i))
    .filter(Boolean)

  const fieldErrors = {}
  const title = String(form.title || '').trim()
  if (!title) fieldErrors.title = 'Activity title is required.'
  else if (title.length > 255) fieldErrors.title = 'The title must be 255 characters or fewer.'
  if (String(form.description || '').length > 5000) fieldErrors.description = 'The description must be 5,000 characters or fewer.'
  if (String(form.instructions || '').length > 5000) fieldErrors.instructions = 'Instructions must be 5,000 characters or fewer.'
  if (!form.type) fieldErrors.type = 'Assessment type is required.'
  if (!form.questions?.length) fieldErrors.questions = 'Add at least one question.'
  if ((form.questions || []).length > 100) fieldErrors.questions = 'An assessment can have at most 100 questions.'
  applyScheduleErrors(form, fieldErrors)

  const assignmentErrors = validateTargeting(targeting, context)

  return { questionErrors, fieldErrors, assignmentErrors, valid: !questionErrors.length && !Object.keys(fieldErrors).length && !assignmentErrors.length }
}

export function validateTargeting(targeting, context = {}) {
  const students = context.students || []
  const programs = context.programs || []
  const sectionIds = new Set(programs.flatMap((program) => (program.sections || []).map((section) => String(section.id))))
  if (targeting.mode === 'sections') {
    if (!targeting.sectionIds.length) {
      return ['Select at least one section or choose a different audience option.']
    }
    if (targeting.sectionIds.length > 100) {
      return ['Select no more than 100 sections.']
    }
    if (sectionIds.size && targeting.sectionIds.some((id) => !sectionIds.has(String(id)))) {
      return ['One or more selected sections are not in BS Hospitality Management or BS Tourism Management.']
    }
    if (students.length) {
      const eligible = students.filter((student) => {
        const profile = student.student_profile || student.studentProfile
        const sectionId = profile?.section?.id || profile?.section_id
        const placed = targeting.sectionIds.map(String).includes(String(sectionId))
        const active = !student.status || student.status === 'active'
        const academic = !profile?.academic_status || profile.academic_status === 'active'
        return placed && active && academic
      })
      if (!eligible.length) {
        return ['The selected sections have no eligible students.']
      }
    }
  }
  if (targeting.mode === 'students') {
    if (!targeting.studentIds.length) {
      return ['Select at least one student or choose a different audience option.']
    }
    if (targeting.studentIds.length > 500) {
      return ['Select no more than 500 students.']
    }
    if (students.length) {
      const eligibleIds = new Set(students.filter((student) => {
        const profile = student.student_profile || student.studentProfile
        const sectionId = profile?.section?.id || profile?.section_id
        const active = !student.status || student.status === 'active'
        const academic = !profile?.academic_status || profile.academic_status === 'active'
        return sectionId && active && academic
      }).map((student) => String(student.id)))
      if (targeting.studentIds.some((id) => !eligibleIds.has(String(id)))) {
        return ['Every selected student must be an active student placed in a section.']
      }
    }
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
    ...schedulePayload(form),
    assignments: buildAssignments(targeting),
    questions: (form.questions || []).map((q) => ({
      type: q.type,
      body: q.body ?? '',
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
          text: c.text ?? '',
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

export function toApiDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function schedulePayload(form) {
  const minutes = form.time_limit_minutes
  return {
    time_limit_minutes: minutes === '' || minutes == null ? null : Number(minutes),
    starts_at: toApiDate(form.starts_at),
    ends_at: toApiDate(form.ends_at),
    open_mode: form.open_mode === 'automatic' ? 'automatic' : 'manual',
    late_policy: form.late_policy === 'finish' ? 'finish' : 'lock',
  }
}

export function scheduleFormFields(activity = {}) {
  return {
    time_limit_minutes: activity.time_limit_minutes ?? '',
    starts_at: toDatetimeLocal(activity.starts_at),
    ends_at: toDatetimeLocal(activity.ends_at),
    open_mode: activity.open_mode === 'automatic' ? 'automatic' : 'manual',
    late_policy: activity.late_policy === 'finish' ? 'finish' : 'lock',
  }
}

function applyScheduleErrors(form, fieldErrors) {
  const start = form.starts_at ? new Date(form.starts_at) : null
  const end = form.ends_at ? new Date(form.ends_at) : null
  const startOk = start && !Number.isNaN(start.getTime())
  const endOk = end && !Number.isNaN(end.getTime())
  if ((form.starts_at && !startOk) || (form.ends_at && !endOk)) {
    fieldErrors.ends_at = 'Enter a valid start and end date.'
  }
  if (startOk && endOk && end <= start) {
    fieldErrors.ends_at = 'End time must be later than the start time.'
  }
  if (endOk && end <= new Date()) {
    fieldErrors.ends_at = 'End time must still be in the future.'
  }
  if (form.open_mode === 'automatic' && !form.starts_at) {
    fieldErrors.starts_at = 'Automatic opening needs a start date and time.'
  }
  if (form.time_limit_minutes !== '' && form.time_limit_minutes != null) {
    const minutes = Number(form.time_limit_minutes)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 480) {
      fieldErrors.time_limit_minutes = 'The time limit must be a whole number from 1 to 480 minutes.'
    } else if (startOk && endOk) {
      const windowMinutes = Math.floor((end.getTime() - start.getTime()) / 60000)
      if (minutes > windowMinutes) {
        fieldErrors.time_limit_minutes = 'The time limit cannot be longer than the time between the start and the end.'
      }
    }
  }
}

export function activityToForm(activity) {
  return {
    title: activity.title || '',
    description: activity.description || '',
    instructions: activity.instructions || '',
    type: activity.type || 'quiz',
    ...scheduleFormFields(activity),
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
  return `${program?.code || program?.name || ''} ${section.year_level}-${section.name} | ${sem}`.trim()
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
      scoring: defaultScenarioScoring(),
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

export function validateSimulation(form, targeting, context = {}) {
  const fieldErrors = {}
  const config = form.simulation_config || {}
  const title = String(form.title || '').trim()
  if (!title) fieldErrors.title = 'Activity title is required.'
  else if (title.length > 255) fieldErrors.title = 'The title must be 255 characters or fewer.'
  if (String(form.description || '').length > 5000) fieldErrors.description = 'The description must be 5,000 characters or fewer.'
  if (String(form.instructions || '').length > 5000) fieldErrors.instructions = 'Instructions must be 5,000 characters or fewer.'

  const hotel = String(config.hotel_name || '').trim()
  if (!hotel) fieldErrors.hotel = 'Hotel name is required.'
  else if (hotel.length > 120) fieldErrors.hotel = 'Hotel name must be 120 characters or fewer.'

  const roomTypes = config.room_types || []
  if (!roomTypes.length) fieldErrors.room_types = 'Add at least one room type.'
  else if (roomTypes.length > 20) fieldErrors.room_types = 'Use no more than 20 room types.'
  const codes = new Map()
  roomTypes.forEach((type, index) => {
    const code = String(type.code || '').trim()
    const label = String(type.label || '').trim()
    const guests = Number(type.max_guests)
    const rack = Number(type.rates?.rack)
    const promo = Number(type.rates?.discount)
    if (!/^[A-Za-z0-9]{1,8}$/.test(code)) fieldErrors.room_types = `Room type ${index + 1} needs a short code of letters and numbers.`
    if (codes.has(code.toUpperCase())) fieldErrors.room_types = 'Room type codes must be unique.'
    codes.set(code.toUpperCase(), type)
    if (!label || label.length > 40) fieldErrors.room_types = `Room type ${index + 1} needs a display name of 40 characters or fewer.`
    if (!Number.isInteger(guests) || guests < 1 || guests > 20) fieldErrors.room_types = `Room type ${index + 1} must allow 1 to 20 guests.`
    if (!Number.isFinite(rack) || rack < 0 || rack > 1000000) fieldErrors.room_types = `Room type ${index + 1} needs a regular rate of 0 or more.`
    if (!Number.isFinite(promo) || promo < 0 || promo > rack) fieldErrors.room_types = `Room type ${index + 1}: the promo rate cannot be higher than the regular rate.`
  })

  const rooms = config.rooms || []
  if (!rooms.length) fieldErrors.rooms = 'Add at least one room.'
  else if (rooms.length > 200) fieldErrors.rooms = 'Use no more than 200 rooms.'
  const numbers = new Set()
  let available = 0
  rooms.forEach((room, index) => {
    const number = String(room.number || '').trim()
    if (!number || number.length > 10) fieldErrors.rooms = `Room ${index + 1} needs a room number.`
    if (numbers.has(number.toLowerCase())) fieldErrors.rooms = 'Room numbers must be unique.'
    numbers.add(number.toLowerCase())
    if (!codes.has(String(room.room_type || '').trim().toUpperCase())) fieldErrors.rooms = `Room ${number || index + 1} must use a room type from the list.`
    if (!['available', 'booked', 'occupied'].includes(room.status)) fieldErrors.rooms = `Room ${number || index + 1} has an unknown starting status.`
    if (room.status === 'available') available += 1
  })
  if (rooms.length && available < 1) fieldErrors.rooms = 'At least one room must start as available.'

  const briefing = String(config.scenario?.briefing || '').trim()
  if (!briefing) fieldErrors.briefing = 'The student briefing is required.'
  else if (briefing.length > 2000) fieldErrors.briefing = 'The briefing must be 2,000 characters or fewer.'

  const guest = config.scenario?.guest || {}
  if (!String(guest.last_name || '').trim() || !String(guest.first_name || '').trim()) {
    fieldErrors.guest = 'Scenario guest first and last name are required.'
  } else if (String(guest.first_name).trim().length > 80 || String(guest.last_name).trim().length > 80) {
    fieldErrors.guest = 'Guest names must be 80 characters or fewer.'
  }
  const phone = String(guest.phone || '').trim()
  if (!/^[0-9+\-\s()]{7,20}$/.test(phone)) {
    fieldErrors.guest = 'Scenario guest phone must be 7 to 20 digits.'
  }

  const res = config.scenario?.reservation || {}
  const nights = Number(res.nights)
  const party = Number(res.guests)
  const room = rooms.find((item) => String(item.number || '').trim().toLowerCase() === String(res.room_number || '').trim().toLowerCase())
  const type = roomTypes.find((item) => String(item.code || '').trim().toUpperCase() === String(res.room_type || '').trim().toUpperCase())
  if (!String(res.room_number || '').trim() || !String(res.room_type || '').trim()) {
    fieldErrors.reservation = 'Scenario room type and room number are required.'
  } else if (!room) {
    fieldErrors.reservation = 'The answer-key room number must be one of the hotel rooms.'
  } else if (!type || String(room.room_type || '').trim().toUpperCase() !== String(type.code || '').trim().toUpperCase()) {
    fieldErrors.reservation = 'The answer-key room type must match that room.'
  } else if (room.status !== 'available') {
    fieldErrors.reservation = 'The answer-key room must start as available.'
  }
  if (!res.arrival_date || Number.isNaN(new Date(`${res.arrival_date}T00:00`).getTime())) {
    if (!fieldErrors.reservation) fieldErrors.reservation = 'The answer-key arrival date is required.'
  }
  if (!Number.isInteger(nights) || nights < 1 || nights > 30) {
    if (!fieldErrors.reservation) fieldErrors.reservation = 'The stay must be from 1 to 30 nights.'
  }
  if (!Number.isInteger(party) || party < 1 || (type && party > Number(type.max_guests))) {
    if (!fieldErrors.reservation) fieldErrors.reservation = 'The guest count must fit the selected room type.'
  }
  if (!['rack', 'discount'].includes(String(res.rate_type || 'rack').toLowerCase())) {
    if (!fieldErrors.reservation) fieldErrors.reservation = 'The price to charge must be the regular or promo rate.'
  }

  const sheet = config.scenario?.scoring
  if (sheet) {
    const included = normalizeScenarioRows(sheet.scenarios)
    const deduction = Number(sheet.deduction)
    const playable = included.filter((item) => item.action !== 'instruction')
    const usedActions = new Set()
    if (!included.length) fieldErrors.scoring = 'Add at least one scenario.'
    if (included.length > MAX_SCENARIOS) fieldErrors.scoring = `Use no more than ${MAX_SCENARIOS} scenarios.`
    if (!Number.isInteger(deduction) || deduction < 0 || deduction > 20) fieldErrors.scoring = 'The deduction for a wrong try must be a whole number from 0 to 20.'
    if (included.some((item) => !String(item.title || '').trim() || String(item.title).trim().length > 120)) fieldErrors.scoring = 'Each scenario needs a title of 120 characters or fewer.'
    if (included.some((item) => !String(item.instruction || '').trim())) fieldErrors.scoring = 'Each scenario needs the instruction students must follow.'
    if (included.some((item) => String(item.instruction || '').length > 2000)) fieldErrors.scoring = 'Each scenario instruction must be 2,000 characters or fewer.'
    playable.forEach((item) => {
      if (usedActions.has(item.action)) fieldErrors.scoring = 'Each front-desk step can belong to one scenario. Use Follow this instruction for the extra situations.'
      usedActions.add(item.action)
    })
  }

  const checkOut = config.scenario?.check_out || {}
  if (checkOut.required) {
    const folio = Number(checkOut.folio_total)
    const tendered = Number(checkOut.amount_tendered)
    const payment = String(checkOut.payment_type || '')
    if (!Number.isFinite(folio) || folio < 0) fieldErrors.checkout = 'The bill total must be zero or more.'
    if (!['cash', 'card'].includes(payment)) fieldErrors.checkout = 'Payment must be cash or card.'
    if (!Number.isFinite(tendered) || tendered < 0) fieldErrors.checkout = 'The amount tendered must be zero or more.'
    if (payment === 'cash' && tendered + 0.001 < folio) fieldErrors.checkout = 'Cash tendered must cover the bill.'
    if (payment === 'card' && Math.abs(tendered - folio) > 0.01) fieldErrors.checkout = 'A card payment must match the bill total.'
  }

  applyScheduleErrors(form, fieldErrors)

  const assignmentErrors = validateTargeting(targeting, context)
  const valid = !Object.keys(fieldErrors).length && !assignmentErrors.length

  return { fieldErrors, assignmentErrors, valid, questionErrors: [] }
}

export function validateCombination(form, targeting, context = {}) {
  const assessment = validateAssessment(form, targeting, context)
  const simulation = validateSimulation(form, targeting, context)
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
    ...schedulePayload(form),
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
    ...scheduleFormFields(activity),
    simulation_config: activity.simulation_config || emptySimulationConfig(),
    questions: [],
  }
}
