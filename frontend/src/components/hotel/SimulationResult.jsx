import { useNavigate } from 'react-router-dom'

export default function SimulationResult({ score, activityTitle, onDone }) {
  const navigate = useNavigate()
  const criteria = score?.details?.criteria || []

  const handleDone = () => {
    if (onDone) onDone()
    else navigate('/student/activities')
  }

  return (
    <div className="hotel-root">
      <div className="hotel-result">
        <h2 className="text-center text-xl font-bold text-[#491464]">{activityTitle}</h2>
        <p className="text-center text-sm text-[#5c297c] mt-1">Simulation complete</p>
        <div className="hotel-result__score">{score?.percentage ?? 0}%</div>
        {criteria.length > 0 && (
          <div className="hotel-result__criteria">
            {criteria.map((c) => (
              <div key={c.key} className={`hotel-result__criterion ${c.passed ? 'pass' : 'fail'}`}>
                <span>{c.label}</span>
                <span>{c.earned}/{c.points} pts</span>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="hotel-btn hotel-btn--purple mt-6 w-full" onClick={handleDone}>
          Back to Activities
        </button>
      </div>
    </div>
  )
}
