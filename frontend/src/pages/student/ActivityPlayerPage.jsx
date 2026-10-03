import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client from '../../api/client'
import LoadingScreen from '../../components/LoadingScreen'
import ExamIntroOverlay from '../../components/exam/ExamIntroOverlay'
import ExamTimerRing from '../../components/exam/ExamTimerRing'
import IntegrityWarningModal from '../../components/exam/IntegrityWarningModal'
import { useRefreshTick } from '../../context/RealtimeContext'
import '../../styles/activity-player.css'

export default function ActivityPlayerPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const refreshTick = useRefreshTick()

  const [meta, setMeta] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [selected, setSelected] = useState([])
  const [phase, setPhase] = useState('loading')
  const [result, setResult] = useState(null)
  const [activitySecondsLeft, setActivitySecondsLeft] = useState(null)
  const [activitySecondsTotal, setActivitySecondsTotal] = useState(null)
  const [questionProgress, setQuestionProgress] = useState(null)
  const [questionLocked, setQuestionLocked] = useState(false)
  const [choicesLocked, setChoicesLocked] = useState(false)
  const [integrityWarning, setIntegrityWarning] = useState(null)

  const submittedRef = useRef(false)
  const indexRef = useRef(0)
  const attemptRef = useRef(null)
  const phaseRef = useRef('loading')
  const advanceQuestionRef = useRef(null)
  const answerRef = useRef('')
  const selectedRef = useRef([])
  const questionLockedRef = useRef(false)
  const tabSwitchLoggedRef = useRef(false)
  const handleSubmitRef = useRef(null)

  useEffect(() => { indexRef.current = index }, [index])
  useEffect(() => { attemptRef.current = attempt }, [attempt])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { answerRef.current = answer }, [answer])
  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => { questionLockedRef.current = questionLocked }, [questionLocked])

  useEffect(() => {
    client.get(`/student/activities/${id}`)
      .then((res) => {
        const existing = res.data.attempt
        if (existing?.status === 'simulation_pending') {
          navigate(`/student/activities/${id}/simulate`, { replace: true })
          return
        }
        if (existing && ['submitted', 'failed', 'missed'].includes(existing.status)) {
          navigate('/student/activities', { replace: true })
          return
        }
        setMeta(res.data)
        setPhase('intro')
      })
      .catch(() => navigate('/student/activities', { replace: true }))
  }, [id, navigate])

  const currentAnswerText = useCallback(() => {
    const q = questions[indexRef.current]
    if (!q) return ''
    if (q.type === 'mcq' && q.metadata?.allow_multiple_correct) {
      return [...selectedRef.current].sort().join(',')
    }
    return answerRef.current
  }, [questions])

  const loadResult = useCallback(async (attemptId) => {
    const res = await client.get(`/student/attempts/${attemptId}/result`)
    setResult(res.data)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (submittedRef.current || !attemptRef.current) return
    submittedRef.current = true
    try {
      const q = questions[indexRef.current]
      if (q) {
        await client.post(`/student/attempts/${attemptRef.current.id}/answer`, {
          question_id: q.id,
          answer_text: currentAnswerText(),
        })
      }
      await client.post(`/student/attempts/${attemptRef.current.id}/submit`)
      await loadResult(attemptRef.current.id)
      setPhase('result')
    } catch {
      submittedRef.current = false
    }
  }, [questions, currentAnswerText, loadResult])

  useEffect(() => {
    handleSubmitRef.current = handleSubmit
  }, [handleSubmit])

  const logTabSwitch = useCallback(async () => {
    if (phaseRef.current !== 'playing' || !attemptRef.current || submittedRef.current) return

    try {
      const res = await client.post(`/student/activities/${id}/integrity`, {
        violation_type: 'tab_switch',
        attempt_id: attemptRef.current.id,
      })

      if (res.data.disqualified) {
        setIntegrityWarning({
          warningNumber: res.data.warning_number || 3,
          warningsLeft: 0,
          isFinal: true,
        })
        return
      }

      if (res.data.warning_number > 0) {
        setIntegrityWarning({
          warningNumber: res.data.warning_number,
          warningsLeft: res.data.warnings_left,
          isFinal: false,
        })
      }
    } catch {
      tabSwitchLoggedRef.current = false
    }
  }, [id])

  const dismissIntegrityWarning = useCallback(async () => {
    setIntegrityWarning((current) => {
      if (current?.isFinal) {
        submittedRef.current = true
        loadResult(attemptRef.current.id)
          .then(() => setPhase('disqualified'))
          .catch(() => setPhase('disqualified'))
      }
      return null
    })
  }, [loadResult])

  useEffect(() => {
    if (phase !== 'playing') return undefined

    const reportTabSwitch = () => {
      if (!document.hidden || tabSwitchLoggedRef.current) return
      tabSwitchLoggedRef.current = true
      logTabSwitch()
    }

    const onVisibility = () => {
      if (document.hidden) {
        reportTabSwitch()
        return
      }
      tabSwitchLoggedRef.current = false
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', reportTabSwitch)
    const blockMenu = (e) => e.preventDefault()
    document.addEventListener('contextmenu', blockMenu)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', reportTabSwitch)
      document.removeEventListener('contextmenu', blockMenu)
    }
  }, [phase, logTabSwitch])

  const saveAnswer = useCallback(async (force = false) => {
    const q = questions[indexRef.current]
    if (!q || !attemptRef.current) return
    if (!force && questionLockedRef.current) return
    await client.post(`/student/attempts/${attemptRef.current.id}/answer`, {
      question_id: q.id,
      answer_text: currentAnswerText(),
    })
  }, [questions, currentAnswerText])

  const advanceQuestion = useCallback(async (forced = false) => {
    if (submittedRef.current) return
    if (!forced && !questionLockedRef.current) return

    await saveAnswer(true).catch(() => {})
    const currentIndex = indexRef.current
    if (currentIndex + 1 >= questions.length) {
      await handleSubmitRef.current?.()
    } else {
      setIndex(currentIndex + 1)
    }
  }, [saveAnswer, questions.length])

  const goNextOrSubmit = useCallback(async () => {
    if (submittedRef.current) return

    const q = questions[indexRef.current]
    const hasAnswer = q?.type === 'mcq' && q.metadata?.allow_multiple_correct
      ? selectedRef.current.length > 0
      : Boolean(answerRef.current)

    if (!hasAnswer && !questionLockedRef.current) return

    await saveAnswer(true).catch(() => {})

    if (indexRef.current + 1 >= questions.length) {
      await handleSubmitRef.current?.()
      return
    }

    setIndex(indexRef.current + 1)
  }, [saveAnswer, questions.length])

  useEffect(() => {
    advanceQuestionRef.current = advanceQuestion
  }, [advanceQuestion])

  useEffect(() => {
    if (phase !== 'playing' || !attempt) return undefined

    let deadlineMs = attempt.server_deadline_at
      ? new Date(attempt.server_deadline_at).getTime()
      : null

    if (!deadlineMs && meta?.activity?.time_limit_minutes && attempt.started_at) {
      deadlineMs = new Date(attempt.started_at).getTime()
        + Number(meta.activity.time_limit_minutes) * 60 * 1000
    }

    if (!deadlineMs && meta?.activity?.ends_at) {
      deadlineMs = new Date(meta.activity.ends_at).getTime()
    }

    if (!deadlineMs) {
      setActivitySecondsLeft(null)
      setActivitySecondsTotal(null)
      return undefined
    }

    const startedMs = attempt.started_at
      ? new Date(attempt.started_at).getTime()
      : deadlineMs - (Number(meta?.activity?.time_limit_minutes || 0) * 60 * 1000)
    const totalSeconds = Math.max(1, Math.floor((deadlineMs - startedMs) / 1000))
    setActivitySecondsTotal(totalSeconds)

    const tick = () => {
      const left = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000))
      setActivitySecondsLeft(left)
      if (left === 0 && !submittedRef.current) handleSubmitRef.current?.()
    }

    tick()
    const timer = setInterval(tick, 250)
    return () => clearInterval(timer)
  }, [attempt, phase, meta?.activity])

  useEffect(() => {
    if (phase !== 'playing') return undefined

    const q = questions[index]
    if (!q) return undefined

    setAnswer('')
    setSelected([])
    setQuestionLocked(false)
    setChoicesLocked(false)

    if (!q.timer_seconds || Number(q.timer_seconds) <= 0) {
      setQuestionProgress(null)
      return undefined
    }

    const total = Number(q.timer_seconds)
    setQuestionProgress(100)
    let remaining = total

    const timer = setInterval(() => {
      remaining -= 0.25
      const progress = Math.max(0, (remaining / total) * 100)
      setQuestionProgress(progress)

      if (remaining <= 0) {
        clearInterval(timer)
        setQuestionLocked(true)
        setQuestionProgress(0)
        window.setTimeout(() => advanceQuestionRef.current?.(true), 0)
      }
    }, 250)

    return () => clearInterval(timer)
  }, [index, phase, questions[index]?.id])

  useEffect(() => {
    if (phase !== 'result' && phase !== 'disqualified') return undefined
    if (!attemptRef.current || !result?.pending_manual_review) return undefined

    const poll = setInterval(() => {
      loadResult(attemptRef.current.id).catch(() => {})
    }, 15000)

    return () => clearInterval(poll)
  }, [phase, result?.pending_manual_review, loadResult])

  useEffect(() => {
    if (phase !== 'result' && phase !== 'disqualified') return undefined
    if (!attemptRef.current) return undefined

    loadResult(attemptRef.current.id).catch(() => {})
  }, [refreshTick, phase, loadResult])

  const beginExam = useCallback(async () => {
    try {
      const res = await client.post(`/student/activities/${id}/start`)
      setAttempt(res.data.attempt)
      setQuestions(res.data.questions || [])
      setPhase('playing')
      client.post(`/student/activities/${id}/integrity`, {
        violation_type: 'session_start',
        attempt_id: res.data.attempt.id,
      }).catch(() => {})
    } catch {
      navigate('/student/activities', { replace: true })
    }
  }, [id, navigate])

  const toggleChoice = (label) => {
    if (questionLocked || choicesLocked) return
    setSelected((prev) => (
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    ))
  }

  const selectChoice = (label) => {
    if (questionLocked || choicesLocked) return
    const current = questions[index]
    if (current?.type === 'mcq' && current.metadata?.allow_multiple_correct) {
      toggleChoice(label)
      return
    }
    setAnswer(label)
    setChoicesLocked(true)
  }

  const examRingProgress = activitySecondsTotal && activitySecondsLeft != null
    ? (activitySecondsLeft / activitySecondsTotal) * 100
    : 100

  const q = questions[index]
  const multiCorrect = Boolean(q?.metadata?.allow_multiple_correct)
  const hasQuestionTimer = Boolean(q?.timer_seconds && Number(q.timer_seconds) > 0)
  const isLastQuestion = index + 1 >= questions.length
  const hasTypedAnswer = Boolean(String(answer).trim())
  const hasAnswer = multiCorrect ? selected.length > 0 : q?.type === 'mcq' ? choicesLocked : hasTypedAnswer
  const showActionButton = questionLocked || hasAnswer
  const choicesDisabled = questionLocked || choicesLocked
  const showPurple = phase === 'intro' || Boolean(integrityWarning)

  if (phase === 'loading' || !meta) {
    return <LoadingScreen message="Preparing your exam…" />
  }

  if (phase === 'result' || phase === 'disqualified') {
    const scoreValue = result?.score?.percentage ?? 0
    const isFailed = phase === 'disqualified' || result?.status === 'failed'

    return (
      <div className="exam-root">
        <div className="exam-intro-layer">
          <div className="exam-result">
            <h2 className="exam-result__title">
              {isFailed ? 'Exam ended' : result?.status === 'simulation_pending' ? 'Questions submitted' : 'Exam submitted'}
            </h2>
            <p className="exam-result__score">{Number(scoreValue).toFixed(1)}%</p>
            {isFailed && (
              <p className="exam-result__note">You were disqualified after 3 tab-switch warnings.</p>
            )}
            {!isFailed && result?.pending_manual_review && (
              <p className="exam-result__note">
                Some answers need manual checking. Your score will update automatically once your professor reviews them.
              </p>
            )}

            {result?.leaderboard?.length > 0 && (
              <div className="exam-result__leaderboard">
                <h3>Activity leaderboard — Top scores</h3>
                {result.leaderboard.map((row) => (
                  <div key={`${row.rank}-${row.student?.id}`} className="exam-leaderboard-row">
                    <span><strong>#{row.rank}</strong> {row.student?.name || 'Student'}</span>
                    <span>{Number(row.composite_score).toFixed(1)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="exam-result__actions">
              {result?.status === 'simulation_pending' ? (
                <button type="button" onClick={() => navigate(`/student/activities/${id}/simulate`)}>
                  Continue to hotel simulation
                </button>
              ) : (
                <button type="button" onClick={() => navigate('/student/activities')}>
                  Back to activities
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`exam-root ${showPurple ? 'exam-root--purple' : ''}`}>
      {phase === 'intro' && (
        <ExamIntroOverlay
          activityTitle={meta.activity.title}
          onComplete={beginExam}
        />
      )}

      {integrityWarning && (
        <IntegrityWarningModal
          warningNumber={integrityWarning.warningNumber}
          warningsLeft={integrityWarning.warningsLeft}
          isFinal={integrityWarning.isFinal}
          onDismiss={dismissIntegrityWarning}
        />
      )}

      {phase === 'playing' && q && (
        <div className="exam-stage">
          <div className="exam-stage__head">
            <div>
              <h1 className="exam-stage__title">{meta.activity.title}</h1>
              <p className="exam-stage__progress">Question {index + 1} of {questions.length}</p>
            </div>
            {activitySecondsTotal != null && activitySecondsLeft != null && (
              <ExamTimerRing progress={examRingProgress} />
            )}
          </div>

          <div className="exam-card">
            <p className="exam-question-text">{q.body}</p>
            {q.metadata?.image_url && (
              <img src={q.metadata.image_url} alt="" className="exam-question-image" />
            )}

            {q.type === 'mcq' ? (
              <div className="exam-choices">
                {(q.choices || []).map((c) => {
                  const active = multiCorrect ? selected.includes(c.label) : answer === c.label
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`exam-choice ${active ? 'exam-choice--active' : ''} ${choicesDisabled ? 'exam-choice--locked' : ''}`}
                      disabled={choicesDisabled}
                      onClick={() => selectChoice(c.label)}
                    >
                      <span className="exam-choice__marker" aria-hidden="true">
                        {multiCorrect ? (active ? '☑' : '☐') : (active ? '●' : '○')}
                      </span>
                      <span className="font-bold">{c.label}.</span> {c.text}
                    </button>
                  )
                })}
              </div>
            ) : (
              <input
                value={answer}
                disabled={choicesDisabled}
                onChange={(e) => setAnswer(e.target.value)}
                className="exam-input"
                placeholder="Type your answer"
              />
            )}
          </div>

          <div className="exam-stage__foot">
            {hasQuestionTimer && questionProgress != null && (
              <div className="exam-question-timer" aria-hidden="true">
                <div className="exam-question-timer__fill" style={{ width: `${questionProgress}%` }} />
              </div>
            )}
            {showActionButton && (
              <button
                type="button"
                className="exam-next-btn"
                onClick={goNextOrSubmit}
              >
                {isLastQuestion ? 'Submit exam' : 'Next'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
