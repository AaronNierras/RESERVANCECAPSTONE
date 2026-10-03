export default function ExamTimerRing({ progress = 100 }) {
  const size = 52
  const stroke = 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, progress))
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="exam-timer-ring" aria-hidden="true">
      <svg className="exam-timer-ring__svg" viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="exam-timer-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(73, 20, 100, 0.12)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          className="exam-timer-ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#ffb736"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
    </div>
  )
}
