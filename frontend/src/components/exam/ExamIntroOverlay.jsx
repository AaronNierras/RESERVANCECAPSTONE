import { useEffect, useState } from 'react'
import { OWL_SRC } from './examAssets'

export default function ExamIntroOverlay({ activityTitle, onComplete }) {
  const [step, setStep] = useState('rules')
  const [fadePurple, setFadePurple] = useState(false)

  const acceptRules = () => setStep('owl')

  useEffect(() => {
    if (step !== 'owl') return undefined

    const fadeTimer = setTimeout(() => setFadePurple(true), 4200)
    const doneTimer = setTimeout(() => onComplete(), 5200)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [step, onComplete])

  return (
    <div className="exam-intro-layer exam-intro-layer--intro">
      <div
        className={`exam-purple-bg exam-purple-bg--overlay ${step === 'rules' ? 'is-visible' : ''} ${fadePurple ? 'is-dismissing' : ''}`}
        aria-hidden="true"
      />

      {step === 'rules' && (
        <div className="exam-rules-modal exam-rules-modal--visible" role="dialog" aria-modal="true" aria-labelledby="exam-rules-title">
          <h2 id="exam-rules-title" className="exam-rules-modal__title">{activityTitle}</h2>
          <p className="exam-rules-modal__subtitle">Before you begin, read these exam rules carefully.</p>
          <ul className="exam-rules-modal__list">
            <li>No cheating or unauthorized materials.</li>
            <li>Do not switch tabs or leave this window during the exam.</li>
            <li>You get <strong>3 warnings</strong> if you switch tabs. On the 3rd warning, you are <strong>disqualified</strong>.</li>
            <li>Per-question timers auto-advance when time runs out. Unanswered items count as wrong.</li>
          </ul>
          <button type="button" className="exam-rules-modal__btn" onClick={acceptRules}>
            I understand — begin
          </button>
        </div>
      )}

      {step === 'owl' && (
        <img src={OWL_SRC} alt="" className="exam-owl" onError={(e) => { e.currentTarget.style.display = 'none' }} />
      )}
    </div>
  )
}
