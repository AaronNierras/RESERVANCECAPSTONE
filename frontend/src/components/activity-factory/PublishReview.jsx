import { formatSectionLabel } from '../../utils/activityFactory'
import { eligibleStudents } from './TargetAudiencePanel'

function formatWhen(value) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return date.toLocaleString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function PublishReview({
  form,
  targeting,
  programs,
  students,
  hotelReady,
  questionsReady,
  onEdit,
  onPublish,
  publishing,
}) {
  const sections = programs.flatMap((program) => (program.sections || []).map((section) => ({ ...section, program })))
  const roster = eligibleStudents(students)
  const chosenSections = targeting.mode === 'all'
    ? sections
    : sections.filter((section) => targeting.sectionIds.map(String).includes(String(section.id)))
  const chosenStudents = targeting.mode === 'students'
    ? roster.filter((student) => targeting.studentIds.map(String).includes(String(student.id)))
    : []
  const sectionCount = targeting.mode === 'students'
    ? new Set(chosenStudents.map((student) => student.student_profile?.section?.id || student.studentProfile?.section_id).filter(Boolean)).size
    : chosenSections.length
  const studentCount = targeting.mode === 'all'
    ? roster.length
    : targeting.mode === 'sections'
      ? roster.filter((student) => chosenSections.some((section) => String(student.student_profile?.section?.id || student.studentProfile?.section?.id || student.studentProfile?.section_id) === String(section.id))).length
      : chosenStudents.length

  return (
    <div className="af-review">
      <h2 className="af-section-title">Review before publishing</h2>
      <p className="af-section-sub">Publishing saves this roster. Students can begin only after the assessment is open and the start time has arrived.</p>
      <dl className="af-review__grid">
        <div>
          <dt>Activity</dt>
          <dd>{form.title} · {form.type}</dd>
          <button type="button" className="af-btn af-btn--ghost" onClick={() => onEdit('setup')}>Edit</button>
        </div>
        <div>
          <dt>Audience</dt>
          <dd>
            {targeting.mode === 'all' ? 'All official sections' : targeting.mode === 'sections' ? 'Selected sections' : 'Selected students'}
            {' · '}
            {sectionCount} section{sectionCount === 1 ? '' : 's'}
            {' · '}
            {studentCount} eligible student{studentCount === 1 ? '' : 's'}
          </dd>
          {chosenSections.slice(0, 4).map((section) => (
            <p key={section.id}>{section.program?.name} · {formatSectionLabel(section, section.program)}</p>
          ))}
          {chosenStudents.slice(0, 6).map((student) => (
            <p key={student.id}>{student.name} · {student.student_profile?.student_number || student.studentProfile?.student_number || 'No number'}</p>
          ))}
          <button type="button" className="af-btn af-btn--ghost" onClick={() => onEdit('audience')}>Edit</button>
        </div>
        <div>
          <dt>Schedule</dt>
          <dd>Starts {formatWhen(form.starts_at)}</dd>
          <dd>Ends {formatWhen(form.ends_at)}</dd>
          <dd>{form.open_mode === 'automatic' ? 'Opens automatically at the start time' : 'Opens when you choose Open for students'}</dd>
          <dd>{form.time_limit_minutes ? `${form.time_limit_minutes} minute time limit` : 'No overall time limit'}</dd>
          <dd>{form.late_policy === 'finish' ? 'A started attempt may be submitted after the deadline.' : 'New work stops at the deadline. A started attempt is submitted when its timer ends.'}</dd>
          <button type="button" className="af-btn af-btn--ghost" onClick={() => onEdit('schedule')}>Edit</button>
        </div>
        <div>
          <dt>Instructions</dt>
          <dd>{form.instructions?.trim() || 'No instructions entered.'}</dd>
          <button type="button" className="af-btn af-btn--ghost" onClick={() => onEdit('schedule')}>Edit</button>
        </div>
        {(form.type === 'simulation' || form.type === 'combination') && (
          <div>
            <dt>Hotel scenario</dt>
            <dd>{hotelReady ? 'Hotel rooms and the scenario answer key are complete.' : 'The hotel or scenario still needs required details.'}</dd>
            <button type="button" className="af-btn af-btn--ghost" onClick={() => onEdit('hotel')}>Edit hotel</button>
            <button type="button" className="af-btn af-btn--ghost" onClick={() => onEdit('scenario')}>Edit scenario</button>
          </div>
        )}
        {form.type !== 'simulation' && (
          <div>
            <dt>Written questions</dt>
            <dd>{questionsReady ? `${form.questions?.length || 0} questions are ready.` : 'Questions still need required answers.'}</dd>
            <button type="button" className="af-btn af-btn--ghost" onClick={() => onEdit('questions')}>Edit</button>
          </div>
        )}
      </dl>
      <div className="af-actions-bar">
        <button type="button" className="af-btn af-btn--ghost" onClick={() => onEdit('schedule')}>Back to schedule</button>
        <button type="button" className="af-btn af-btn--gold" onClick={onPublish} disabled={publishing}>
          {publishing ? 'Publishing…' : 'Publish assessment'}
        </button>
      </div>
    </div>
  )
}
