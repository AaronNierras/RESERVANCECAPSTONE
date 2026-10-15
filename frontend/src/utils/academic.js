export const YEAR_LEVELS = [
  { value: 1, label: '1st Year' },
  { value: 2, label: '2nd Year' },
  { value: 3, label: '3rd Year' },
  { value: 4, label: '4th Year' },
]

export const SECTION_SEMESTERS = [
  { value: 1, label: '1st Semester' },
  { value: 2, label: '2nd Semester' },
  { value: 3, label: 'Summer' },
]

export function sectionSemesterLabel(semester) {
  return SECTION_SEMESTERS.find((item) => item.value === Number(semester))?.label || `Semester ${semester}`
}

export function sectionSemesterShortLabel(semester) {
  switch (Number(semester)) {
    case 1:
      return 'FIRST SEM'
    case 2:
      return 'SECOND SEM'
    case 3:
      return 'SUMMER'
    default:
      return `SEM ${semester}`.toUpperCase()
  }
}

export function formatSectionLabel(programName, yearLevel, sectionName, semester) {
  if (!programName || !sectionName) return sectionName || '—'
  const sectionCode = yearLevel ? `${yearLevel}-${sectionName}` : sectionName
  const base = `${programName} ${sectionCode}`
  if (semester) return `${base} | ${sectionSemesterShortLabel(semester)}`
  return base
}

export function sanitizeProgramName(value) {
  return value.replace(/[^A-Za-z]/g, '').toUpperCase()
}

export function validateProgramForm(form) {
  const errors = {}
  const programNamePattern = /^[A-Za-z]+$/

  if (!form.name?.trim()) errors.name = 'Program name is required.'
  else if (!programNamePattern.test(form.name.trim())) errors.name = 'Letters only — no numbers or special characters.'

  return errors
}

export function sanitizeSectionName(value) {
  return value.replace(/[^A-Za-z]/g, '').toUpperCase()
}

export function validateSectionForm(form) {
  const errors = {}
  const sectionNamePattern = /^[A-Za-z]+$/

  if (!form.program_id) errors.program_id = 'Program is required.'
  if (!form.name?.trim()) errors.name = 'Section name is required.'
  else if (!sectionNamePattern.test(form.name.trim())) errors.name = 'Letters only — no numbers (use Year level for the number).'
  if (!form.year_level) errors.year_level = 'Year level is required.'
  if (!form.semester) errors.semester = 'Semester is required.'

  return errors
}

export function yearLevelLabel(level) {
  return YEAR_LEVELS.find((item) => item.value === Number(level))?.label || `Year ${level}`
}

export function capitalizeName(value) {
  if (!value) return ''
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function validateStudentForm(form) {
  const errors = {}
  const namePattern = /^[A-Za-z\s-]+$/
  const emailPattern = /@student\.mcu\.edu\.ph$/i
  const studentNumberPattern = /^[A-Za-z0-9]+$/
  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

  if (!form.first_name?.trim()) errors.first_name = 'First name is required.'
  else if (!namePattern.test(form.first_name.trim())) errors.first_name = 'Letters only.'

  if (!form.last_name?.trim()) errors.last_name = 'Last name is required.'
  else if (!namePattern.test(form.last_name.trim())) errors.last_name = 'Letters only.'

  if (!form.email?.trim()) errors.email = 'Email is required.'
  else if (!emailPattern.test(form.email.trim())) errors.email = 'Must end with @student.mcu.edu.ph.'

  if (!form.student_number?.trim()) errors.student_number = 'Student number is required.'
  else if (!studentNumberPattern.test(form.student_number.trim())) errors.student_number = 'No special characters.'

  if (!form.password) errors.password = 'Password is required.'
  else if (!passwordPattern.test(form.password)) {
    errors.password = 'Use 8+ chars with upper, lower, number, and symbol.'
  }

  if (!form.program_id) errors.program_id = 'Program is required.'
  if (!form.section_id) errors.section_id = 'Section is required.'

  return errors
}

export function validateStudentRegistration(form) {
  const errors = {}
  const namePattern = /^[A-Za-z\s-]+$/
  const emailPattern = /@student\.mcu\.edu\.ph$/i
  const studentNumberPattern = /^[A-Za-z0-9]+$/
  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

  if (!form.first_name?.trim()) errors.first_name = 'First name is required.'
  else if (!namePattern.test(form.first_name.trim())) errors.first_name = 'First name may contain letters only.'

  if (!form.last_name?.trim()) errors.last_name = 'Last name is required.'
  else if (!namePattern.test(form.last_name.trim())) errors.last_name = 'Last name may contain letters only.'

  if (!form.student_number?.trim()) errors.student_number = 'Student number is required.'
  else if (!studentNumberPattern.test(form.student_number.trim())) {
    errors.student_number = 'Student number cannot contain special characters.'
  }

  if (!form.email?.trim()) errors.email = 'Email is required.'
  else if (!emailPattern.test(form.email.trim())) errors.email = 'Email must end with @student.mcu.edu.ph.'

  if (!form.password) errors.password = 'Password is required.'
  else if (!passwordPattern.test(form.password)) {
    errors.password = 'Password must include uppercase, lowercase, number, and special character.'
  }

  if (!form.password_confirmation) errors.password_confirmation = 'Confirm your password.'
  else if (form.password_confirmation !== form.password) {
    errors.password_confirmation = 'Password confirmation does not match.'
  }

  return errors
}

export function validateFacultyForm(form) {
  const errors = {}
  const namePattern = /^[A-Za-z\s-]+$/
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

  if (!form.first_name?.trim()) errors.first_name = 'First name is required.'
  else if (!namePattern.test(form.first_name.trim())) errors.first_name = 'Letters only.'

  if (!form.last_name?.trim()) errors.last_name = 'Last name is required.'
  else if (!namePattern.test(form.last_name.trim())) errors.last_name = 'Letters only.'

  if (!form.email?.trim()) errors.email = 'Email is required.'
  else if (!emailPattern.test(form.email.trim())) errors.email = 'Enter a valid email with @ and a domain.'

  if (!form.password) errors.password = 'Password is required.'
  else if (!passwordPattern.test(form.password)) {
    errors.password = 'Use 8+ chars with upper, lower, number, and symbol.'
  }

  return errors
}
