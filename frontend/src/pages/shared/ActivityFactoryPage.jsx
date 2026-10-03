import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import client, { getStoredUser } from '../../api/client'
import { useActivityFactoryGuard, useGuardedNavigation } from '../../context/ActivityFactoryGuardContext'
import { formatBytes } from '../../utils/questionImage'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import ActivityManagerPanel from '../../components/activity-factory/ActivityManagerPanel'
import QuestionCard from '../../components/activity-factory/QuestionCard'
import TargetAudiencePanel from '../../components/activity-factory/TargetAudiencePanel'
import SimulationHotelPanel from '../../components/simulation-factory/SimulationHotelPanel'
import SimulationScenarioPanel from '../../components/simulation-factory/SimulationScenarioPanel'
import {
  ASSESSMENT_TYPES,
  COMBINATION_WORKSPACE_STEPS,
  SIMULATION_WORKSPACE_STEPS,
  WORKSPACE_STEPS,
  activityToForm,
  combinationActivityToForm,
  combinationToApiPayload,
  assignmentsToTargeting,
  buildAssignments,
  createQuestions,
  emptySimulationConfig,
  simulationActivityToForm,
  simulationToApiPayload,
  toApiPayload,
  validateAssessment,
  validateCombination,
  validateSimulation,
} from '../../utils/activityFactory'
import '../../styles/activity-factory.css'
import '../../styles/hotel-simulation.css'

const INITIAL_SETUP = {
  title: '',
  description: '',
  instructions: '',
  type: 'quiz',
  questionCount: 1,
}

const INITIAL_TARGETING = { mode: 'all', sectionIds: [], studentIds: [] }

export default function ActivityFactoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const openedDraftRef = useRef(null)
  const [view, setView] = useState('hub')
  const [step, setStep] = useState('setup')
  const [workspaceStarted, setWorkspaceStarted] = useState(false)
  const [draftId, setDraftId] = useState(null)
  const [setup, setSetup] = useState(INITIAL_SETUP)
  const [form, setForm] = useState(null)
  const [targeting, setTargeting] = useState(INITIAL_TARGETING)
  const [activities, setActivities] = useState([])
  const [programs, setPrograms] = useState([])
  const [students, setStudents] = useState([])
  const [autoSave, setAutoSave] = useState(true)
  const [saveState, setSaveState] = useState('idle')
  const [dirty, setDirty] = useState(false)
  const [validation, setValidation] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageUploadNote, setImageUploadNote] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [importError, setImportError] = useState('')
  const [importNotice, setImportNotice] = useState('')
  const saveTimerRef = useRef(null)
  const fileInputRef = useRef(null)
  const { registerGuard, unregisterGuard } = useActivityFactoryGuard()
  const { guardedAction } = useGuardedNavigation()

  const load = useCallback(() => {
    client.get('/activities').then((res) => setActivities(res.data.activities || []))
    client.get('/programs').catch(() => ({ data: { programs: [] } })).then((res) => setPrograms(res.data.programs || []))
    const user = getStoredUser()
    const studentsUrl = user?.role === 'super_admin' ? '/super-admin/students' : '/faculty/students'
    client.get(studentsUrl).catch(() => ({ data: { students: [] } })).then((res) => setStudents(res.data.students || []))
  }, [])

  useAutoRefresh(load, [])

  const openDraft = useCallback(async (activity) => {
    const res = await client.get(`/activities/${activity.id}`)
    const loaded = res.data.activity
    setDraftId(loaded.id)
    setSetup({
      title: loaded.title,
      description: loaded.description || '',
      instructions: loaded.instructions || '',
      type: loaded.type,
      questionCount: loaded.questions?.length || 1,
    })
    setForm(
      loaded.type === 'simulation'
        ? simulationActivityToForm(loaded)
        : loaded.type === 'combination'
          ? combinationActivityToForm(loaded)
          : activityToForm(loaded)
    )
    setTargeting(assignmentsToTargeting(loaded.assignments))
    setWorkspaceStarted(true)
    setStep(loaded.type === 'simulation' ? 'hotel' : 'questions')
    setView('workspace')
    setDirty(false)
  }, [])

  useEffect(() => {
    const draftParam = searchParams.get('draft')
    if (!draftParam || openedDraftRef.current === draftParam) return

    client.get(`/activities/${draftParam}`)
      .then((res) => {
        if (res.data.activity?.status !== 'draft') return
        openedDraftRef.current = draftParam
        setSearchParams({}, { replace: true })
        openDraft({ id: res.data.activity.id })
        load()
      })
      .catch(() => {})
  }, [searchParams, openDraft, setSearchParams, load])

  const resetWorkspace = () => {
    setView('hub')
    setStep('setup')
    setWorkspaceStarted(false)
    setDraftId(null)
    setSetup(INITIAL_SETUP)
    setForm(null)
    setTargeting(INITIAL_TARGETING)
    setValidation(null)
    setDirty(false)
    setSaveState('idle')
    setImportBusy(false)
    setImportError('')
    setImportNotice('')
  }

  const startNew = () => {
    resetWorkspace()
    setView('workspace')
  }

  const beginCreation = () => {
    if (!setup.title.trim()) {
      setValidation({ fieldErrors: { title: 'Activity title is required.' } })
      return
    }
    if (setup.type === 'combination') {
      const count = Math.max(1, Math.min(100, Number(setup.questionCount) || 1))
      setForm({
        title: setup.title.trim(),
        description: setup.description,
        instructions: setup.instructions,
        type: 'combination',
        time_limit_minutes: '',
        starts_at: '',
        ends_at: '',
        questions: createQuestions(count),
        simulation_config: emptySimulationConfig(),
      })
      setWorkspaceStarted(true)
      setStep('questions')
      setDirty(true)
      setValidation(null)
      return
    }
    if (setup.type === 'simulation') {
      setForm({
        title: setup.title.trim(),
        description: setup.description,
        instructions: setup.instructions,
        type: 'simulation',
        time_limit_minutes: 30,
        starts_at: '',
        ends_at: '',
        simulation_config: emptySimulationConfig(),
        questions: [],
      })
      setWorkspaceStarted(true)
      setStep('hotel')
      setDirty(true)
      setValidation(null)
      return
    }
    const count = Math.max(1, Math.min(100, Number(setup.questionCount) || 1))
    setForm({
      title: setup.title.trim(),
      description: setup.description,
      instructions: setup.instructions,
      type: setup.type,
      time_limit_minutes: '',
      starts_at: '',
      ends_at: '',
      questions: createQuestions(count),
    })
    setWorkspaceStarted(true)
    setStep('questions')
    setDirty(true)
    setValidation(null)
  }

  const persistDraft = useCallback(async ({ leaveAfter = false } = {}) => {
    if (!form && !setup.title.trim()) return null
    setSaveState('saving')
    const payload = form
      ? (form.type === 'simulation'
          ? simulationToApiPayload(form, targeting)
          : form.type === 'combination'
            ? combinationToApiPayload(form, targeting)
            : toApiPayload(form, targeting))
      : {
          title: setup.title.trim(),
          description: setup.description || '',
          instructions: setup.instructions || '',
          type: setup.type,
          status: 'draft',
          assignments: buildAssignments(targeting),
          questions: [],
        }
    try {
      const res = draftId
        ? await client.put(`/activities/${draftId}`, payload)
        : await client.post('/activities', payload)
      const saved = res.data.activity
      setDraftId(saved.id)
      setDirty(false)
      setSaveState('saved')
      load()
      if (leaveAfter) resetWorkspace()
      return saved
    } catch (err) {
      setSaveState('error')
      throw err
    }
  }, [draftId, form, load, setup, targeting])

  useEffect(() => {
    if (view !== 'workspace') {
      registerGuard({ blocking: false, handlers: {} })
      return undefined
    }

    registerGuard({
      blocking: dirty,
      handlers: {
        onSaveDraft: () => persistDraft(),
        onExit: () => setDirty(false),
      },
    })

    return () => unregisterGuard()
  }, [view, dirty, persistDraft, registerGuard, unregisterGuard])

  const goToStep = (nextStep) => {
    if (nextStep === step) return
    if (nextStep !== 'setup' && !workspaceStarted) return
    guardedAction(() => setStep(nextStep))
  }

  const leaveWorkspace = () => guardedAction(resetWorkspace)

  useEffect(() => {
    if (!autoSave || !dirty || view !== 'workspace') return undefined
    if (!form && !setup.title.trim()) return undefined
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      persistDraft().catch(() => {})
    }, 1800)
    return () => clearTimeout(saveTimerRef.current)
  }, [autoSave, dirty, form, setup.title, targeting, view, persistDraft])

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (dirty && view === 'workspace') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, view])

  const uploadQuestionImage = async (file, originalBytes) => {
    setUploadingImage(true)
    setImageUploadNote('')
    try {
      const body = new FormData()
      body.append('image', file)
      const res = await client.post('/activities/question-image', body)
      const apiBase = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace(/\/api\/?$/, '')
      const payload = {
        ...res.data,
        url: res.data.url?.startsWith('http') ? res.data.url : `${apiBase}/storage/${res.data.path}`,
      }
      if (payload.saved_percent > 0) {
        const from = originalBytes || payload.original_bytes
        setImageUploadNote(`Optimized to ${formatBytes(payload.optimized_bytes)} (${payload.saved_percent}% smaller than ${formatBytes(from)})`)
      } else if (payload.optimized_bytes) {
        setImageUploadNote(`Saved as ${payload.format?.toUpperCase() || 'WebP'} (${formatBytes(payload.optimized_bytes)})`)
      }
      return payload
    } finally {
      setUploadingImage(false)
    }
  }

  const updateQuestion = (index, question) => {
    const next = question.type === 'mcq' && !(question.choices || []).length
      ? { ...question, choices: createQuestions(1)[0].choices }
      : question
    setForm((prev) => {
      const questions = [...prev.questions]
      questions[index] = next
      return { ...prev, questions }
    })
    setDirty(true)
  }

  const startFileGenerate = () => {
    if (setup.type === 'simulation') return
    if (!setup.title.trim()) {
      setStep('setup')
      setImportError('')
      setValidation({ fieldErrors: { title: 'Add a title before generating from a file.' } })
      return
    }
    setImportError('')
    setValidation((current) => {
      if (!current?.fieldErrors?.title) return current
      const fieldErrors = { ...current.fieldErrors }
      delete fieldErrors.title
      return { ...current, fieldErrors }
    })
    fileInputRef.current?.click()
  }

  const onImportFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const count = Math.max(1, Math.min(100, Number(setup.questionCount) || 1))
    setImportBusy(true)
    setImportError('')
    setImportNotice('')
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('type', setup.type === 'combination' ? 'activity' : setup.type)
      body.append('title', setup.title.trim())
      body.append('question_count', String(count))
      const res = await client.post('/activities/generate-from-document', body)
      const questions = res.data.questions || []
      setForm((prev) => ({
        title: setup.title.trim(),
        description: setup.description,
        instructions: setup.instructions,
        type: setup.type,
        time_limit_minutes: prev?.time_limit_minutes || '',
        starts_at: prev?.starts_at || '',
        ends_at: prev?.ends_at || '',
        questions,
        ...(setup.type === 'combination'
          ? { simulation_config: prev?.simulation_config || emptySimulationConfig() }
          : {}),
      }))
      setSetup((current) => ({ ...current, questionCount: questions.length || count }))
      setWorkspaceStarted(true)
      setStep('questions')
      setDirty(true)
      setValidation(null)
      setImportNotice('Questions were built from the file. Edit any question or answer before you continue.')
    } catch (error) {
      const errors = error?.response?.data?.errors
      const first = errors ? Object.values(errors).flat()[0] : ''
      setImportError(first || error?.response?.data?.message || 'The file could not be read.')
      setStep('setup')
    } finally {
      setImportBusy(false)
    }
  }

  const runValidation = () => {
    const result = form?.type === 'simulation'
      ? validateSimulation(form, targeting)
      : form?.type === 'combination'
        ? validateCombination(form, targeting)
        : validateAssessment(form, targeting)
    setValidation(result)
    return result
  }

  const saveDraftManual = async () => {
    await persistDraft()
  }

  const publishAssessment = async () => {
    const result = runValidation()
    if (!result.valid) {
      if (result.questionErrors?.length) setStep('questions')
      else if (result.fieldErrors?.guest || result.fieldErrors?.reservation) setStep('scenario')
      else if (result.fieldErrors?.rooms) setStep('hotel')
      else if (result.assignmentErrors?.length) setStep('audience')
      else setStep('schedule')
      return
    }
    await persistDraft()
    await client.post(`/activities/${draftId}/publish`)
    load()
    resetWorkspace()
  }

  const handlePublishFromHub = async (id) => {
    await client.post(`/activities/${id}/publish`)
    load()
  }

  const handleOpen = async (id) => {
    await client.post(`/activities/${id}/open`)
    load()
  }

  const handleClose = async (id) => {
    await client.post(`/activities/${id}/close`)
    load()
  }

  const handleDelete = async (id) => {
    await client.delete(`/activities/${id}`)
    load()
  }

  const questionErrorsByIndex = useMemo(() => {
    const map = {}
    validation?.questionErrors?.forEach((item) => { map[item.index] = item.errors })
    return map
  }, [validation])

  const currentTypeLabel = ASSESSMENT_TYPES.find((t) => t.value === (form?.type || setup.type))?.label || 'Assessment'
  const assessmentType = form?.type || setup.type
  const isSimulation = assessmentType === 'simulation'
  const isCombination = assessmentType === 'combination'
  const workspaceSteps = isCombination
    ? COMBINATION_WORKSPACE_STEPS
    : isSimulation
      ? SIMULATION_WORKSPACE_STEPS
      : WORKSPACE_STEPS

  if (view === 'hub') {
    return (
      <div className="af-page">
        <div className="af-hero">
          <div className="af-hero__main">
            <div className="af-hero__copy">
              <h1>Activity Factory</h1>
              <p>Create engaging assessments with a guided builder. Save drafts, publish when ready, and open for students only when you choose.</p>
            </div>
            <div className="af-hero__cta">
              <button type="button" className="af-btn af-btn--gold" onClick={startNew}>Create new assessment</button>
            </div>
          </div>
        </div>
        <ActivityManagerPanel
          activities={activities}
          programs={programs}
          onEditDraft={openDraft}
          onPublish={handlePublishFromHub}
          onOpen={handleOpen}
          onClose={handleClose}
          onDelete={handleDelete}
        />
      </div>
    )
  }

  return (
    <div className="af-page af-page--workspace">
      <div className="af-hero">
        <div className="af-hero__main">
          <div className="af-hero__copy">
            <h1>{form?.title || setup.title || 'New assessment'}</h1>
            <p>{currentTypeLabel} · Build questions, choose your audience, then publish and open when students should begin.</p>
          </div>
        </div>
        <div className="af-hero__toolbar">
          <div className="af-hero__toolbar-group">
            <label className="af-toggle">
              <input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} />
              Auto-save
            </label>
            <span className={`af-save-state ${saveState === 'saving' ? 'is-saving' : ''}`}>
              {saveState === 'saving' && 'Saving...'}
              {saveState === 'saved' && 'Saved'}
              {saveState === 'error' && 'Save failed'}
              {saveState === 'idle' && dirty && 'Unsaved changes'}
            </span>
          </div>
          <div className="af-hero__actions">
            {setup.type !== 'simulation' && (
              <button type="button" className="af-btn af-btn--gold" onClick={startFileGenerate} disabled={importBusy}>
                {importBusy ? 'Reading file…' : 'Generate from file'}
              </button>
            )}
            <button type="button" className="af-btn af-btn--ghost" onClick={leaveWorkspace}>
              Back to hub
            </button>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={onImportFile}
            />
          </div>
        </div>
      </div>

      <div className="af-workspace-shell">
        <nav className="af-stepper" aria-label="Assessment builder steps">
          {workspaceSteps.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`af-stepper__item ${step === item.id ? 'is-active' : ''}`}
              onClick={() => goToStep(item.id)}
              disabled={item.id !== 'setup' && !workspaceStarted}
            >
              <span className="af-stepper__num">{index + 1}</span>
              <span className="af-stepper__text">
                <span className="af-stepper__label">{item.label}</span>
                <span className="af-stepper__hint">{item.hint}</span>
              </span>
            </button>
          ))}
        </nav>

        <main className="af-panel af-panel--accent af-workspace">
          <header className="af-workspace-head">
            {step === 'setup' && (
              <>
                <h2 className="af-section-title">Assessment setup</h2>
                <p className="af-section-sub">
                  {isCombination
                    ? 'A combination includes written questions and the hotel simulation. Use Generate from file to build the questions from a Word or PDF file.'
                    : isSimulation
                      ? 'Provide the basics, then start the hotel workspace.'
                      : 'Provide the basics, then start the question workspace. Or use Generate from file to build questions from a Word or PDF file.'}
                </p>
                {importError && <p className="af-error">{importError}</p>}
              </>
            )}
            {step === 'questions' && (
              <>
                <div className="af-toolbar">
                  <span className="af-meta-chip"><strong>Type</strong> {currentTypeLabel}</span>
                  <span className="af-meta-chip"><strong>Title</strong> {form?.title}</span>
                  <span className="af-meta-chip"><strong>Questions</strong> {form?.questions.length}</span>
                </div>
                <h2 className="af-section-title">Question builder</h2>
                <p className="af-section-sub">
                  {importNotice || 'Add choices, timers, images, and checking rules per question.'}
                </p>
              </>
            )}
            {step === 'hotel' && (
              <>
                <h2 className="af-section-title">Hotel setup</h2>
                <p className="af-section-sub">Configure room types, rates, and starting room status for the front desk board.</p>
              </>
            )}
            {step === 'scenario' && (
              <>
                <h2 className="af-section-title">Scenario setup</h2>
                <p className="af-section-sub">Use the 3 sections below — Briefing, Booking, and Check-out — to define what students see and how they are graded.</p>
              </>
            )}
            {step === 'audience' && (
              <>
                <h2 className="af-section-title">Target audience</h2>
                <p className="af-section-sub">Choose who can access this assessment once it is published and opened.</p>
              </>
            )}
            {step === 'schedule' && (
              <>
                <h2 className="af-section-title">Schedule & publication</h2>
                <p className="af-section-sub">Set the availability window, save your draft, then publish. Students can begin only after you open the assessment.</p>
              </>
            )}
          </header>

          <div className="af-workspace-body">
            {step === 'setup' && (
              <div className="af-form-grid af-form-grid--2">
                <div className="af-field">
                  <label htmlFor="af-title">Activity title</label>
                  <input id="af-title" className="af-input" value={setup.title} onChange={(e) => {
                    const title = e.target.value
                    setSetup({ ...setup, title })
                    setDirty(true)
                    if (title.trim()) {
                      setValidation((current) => {
                        if (!current?.fieldErrors?.title) return current
                        const fieldErrors = { ...current.fieldErrors }
                        delete fieldErrors.title
                        return { ...current, fieldErrors }
                      })
                    }
                  }} placeholder="Midterm Quiz 1" />
                  {validation?.fieldErrors?.title && <span className="af-error">{validation.fieldErrors.title}</span>}
                </div>
                <div className="af-field">
                  <label htmlFor="af-type">Assessment type</label>
                  <select id="af-type" className="af-select" value={setup.type} onChange={(e) => { setSetup({ ...setup, type: e.target.value }); setDirty(true) }}>
                    {ASSESSMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="af-field af-form-grid__full">
                  <label htmlFor="af-desc">Description</label>
                  <textarea id="af-desc" className="af-textarea" rows={4} value={setup.description} onChange={(e) => { setSetup({ ...setup, description: e.target.value }); setDirty(true) }} placeholder="Brief overview for faculty and students" />
                </div>
                {!isSimulation && (
                  <div className="af-field">
                    <label htmlFor="af-count">Number of questions</label>
                    <input
                      id="af-count"
                      className="af-input"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={setup.questionCount}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '')
                        setSetup({ ...setup, questionCount: val === '' ? '' : Number(val) })
                        setDirty(true)
                      }}
                      placeholder="1"
                    />
                  </div>
                )}
              </div>
            )}

            {step === 'hotel' && form && (
              <SimulationHotelPanel
                config={form.simulation_config}
                onChange={(config) => { setForm({ ...form, simulation_config: config }); setDirty(true) }}
              />
            )}

            {step === 'scenario' && form && (
              <SimulationScenarioPanel
                config={form.simulation_config}
                onChange={(config) => { setForm({ ...form, simulation_config: config }); setDirty(true) }}
              />
            )}

            {step === 'questions' && form && (
              <div className="af-question-stack">
                {form.questions.map((q, i) => (
                  <QuestionCard
                    key={i}
                    question={q}
                    index={i}
                    errors={questionErrorsByIndex[i] || []}
                    onChange={updateQuestion}
                    onUploadImage={uploadQuestionImage}
                    uploading={uploadingImage}
                    uploadNote={imageUploadNote}
                  />
                ))}
              </div>
            )}

            {step === 'audience' && (
              <TargetAudiencePanel
                targeting={targeting}
                programs={programs}
                students={students}
                errors={validation?.assignmentErrors || []}
                onChange={(next) => { setTargeting(next); setDirty(true) }}
              />
            )}

            {step === 'schedule' && form && (
              <>
                <div className="af-form-grid af-form-grid--2">
                  <div className="af-field">
                    <label htmlFor="af-starts">Start date/time</label>
                    <input id="af-starts" type="datetime-local" className="af-input" value={form.starts_at} onChange={(e) => { setForm({ ...form, starts_at: e.target.value }); setDirty(true) }} />
                  </div>
                  <div className="af-field">
                    <label htmlFor="af-ends">End date/time</label>
                    <input id="af-ends" type="datetime-local" className="af-input" value={form.ends_at} onChange={(e) => { setForm({ ...form, ends_at: e.target.value }); setDirty(true) }} />
                    {validation?.fieldErrors?.ends_at && <span className="af-error">{validation.fieldErrors.ends_at}</span>}
                  </div>
                  <div className="af-field">
                    <label htmlFor="af-limit">Overall time limit (minutes)</label>
                    <input id="af-limit" type="number" min="1" className="af-input" value={form.time_limit_minutes} onChange={(e) => { setForm({ ...form, time_limit_minutes: e.target.value }); setDirty(true) }} placeholder="Optional" />
                  </div>
                  <div className="af-field af-form-grid__full">
                    <label htmlFor="af-instructions">Student instructions</label>
                    <textarea id="af-instructions" className="af-textarea" rows={4} value={form.instructions} onChange={(e) => { setForm({ ...form, instructions: e.target.value }); setDirty(true) }} placeholder="Instructions shown before students begin" />
                  </div>
                </div>
                <p className="af-section-sub" style={{ marginTop: '1.5rem' }}>
                  Publishing makes the assessment complete in your list. Use <strong>Open for students</strong> from the hub when you are ready for attempts to begin.
                </p>
              </>
            )}
          </div>

          <footer className="af-actions-bar">
            {step === 'setup' && (
              <div className="af-actions-bar__group" style={{ marginLeft: 'auto' }}>
                <button type="button" className="af-btn af-btn--gold" onClick={beginCreation}>Start creation</button>
              </div>
            )}
            {step === 'questions' && form && (
              <>
                <div className="af-actions-bar__group">
                  <button type="button" className="af-btn af-btn--ghost" onClick={() => { setForm({ ...form, questions: [...form.questions, ...createQuestions(1)] }); setDirty(true) }}>Add question</button>
                </div>
                <div className="af-actions-bar__group">
                  <button type="button" className="af-btn af-btn--purple" onClick={() => setStep(isCombination ? 'hotel' : 'audience')}>
                    {isCombination ? 'Continue to hotel' : 'Continue to audience'}
                  </button>
                </div>
              </>
            )}
            {step === 'hotel' && form && (
              <>
                {isCombination && (
                  <div className="af-actions-bar__group">
                    <button type="button" className="af-btn af-btn--ghost" onClick={() => setStep('questions')}>Back to questions</button>
                  </div>
                )}
                <div className="af-actions-bar__group" style={{ marginLeft: 'auto' }}>
                  <button type="button" className="af-btn af-btn--purple" onClick={() => setStep('scenario')}>Continue to scenario</button>
                </div>
              </>
            )}
            {step === 'scenario' && form && (
              <>
                <div className="af-actions-bar__group">
                  <button type="button" className="af-btn af-btn--ghost" onClick={() => setStep('hotel')}>Back to hotel</button>
                </div>
                <div className="af-actions-bar__group">
                  <button type="button" className="af-btn af-btn--purple" onClick={() => setStep('audience')}>Continue to audience</button>
                </div>
              </>
            )}
            {step === 'audience' && (
              <>
                <div className="af-actions-bar__group">
                  <button type="button" className="af-btn af-btn--ghost" onClick={() => setStep(isSimulation || isCombination ? 'scenario' : 'questions')}>Back</button>
                </div>
                <div className="af-actions-bar__group">
                  <button type="button" className="af-btn af-btn--purple" onClick={() => setStep('schedule')}>Continue to schedule</button>
                </div>
              </>
            )}
            {step === 'schedule' && form && (
              <>
                <div className="af-actions-bar__group">
                  <button type="button" className="af-btn af-btn--ghost" onClick={() => setStep('audience')}>Back to audience</button>
                  <button type="button" className="af-btn af-btn--ghost" onClick={() => saveDraftManual()}>Save draft</button>
                </div>
                <div className="af-actions-bar__group">
                  <button type="button" className="af-btn af-btn--gold" onClick={publishAssessment}>Publish assessment</button>
                </div>
              </>
            )}
          </footer>
        </main>
      </div>
    </div>
  )
}
