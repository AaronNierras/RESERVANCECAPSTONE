import { useState } from 'react'
import { OWL_SRC } from './examAssets'

export default function IntegrityWarningModal({
  warningNumber,
  warningsLeft,
  isFinal = false,
  onDismiss,
}) {
  const [dismissing, setDismissing] = useState(false)

  const handleDismiss = () => {
    if (dismissing) return
    setDismissing(true)
    window.setTimeout(() => onDismiss(), 420)
  }

  return (
    <div className="exam-intro-layer exam-intro-layer--integrity">
      <div className={`exam-purple-bg exam-purple-bg--overlay ${dismissing ? 'is-dismissing' : 'is-visible'}`} aria-hidden="true" />
      <div className={`exam-warning-modal ${dismissing ? 'is-dismissing' : 'is-visible'}`} role="alertdialog" aria-modal="true">
        <img src={OWL_SRC} alt="" className="exam-warning-modal__owl" />
        <h2 className="exam-warning-modal__title">Stay on this exam</h2>
        <p className="exam-warning-modal__text">
          Tab switch detected. Warning {warningNumber} of 3.
          {warningsLeft > 0
            ? ` You have ${warningsLeft} warning${warningsLeft === 1 ? '' : 's'} left before disqualification.`
            : isFinal
              ? ' This was your final warning. You will be disqualified if you leave again.'
              : ' This was your final warning.'}
        </p>
        <button type="button" className="exam-warning-modal__btn" onClick={handleDismiss}>
          {isFinal ? 'Continue to results' : 'Continue exam'}
        </button>
      </div>
    </div>
  )
}
