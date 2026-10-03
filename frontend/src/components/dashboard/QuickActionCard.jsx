import { Link } from 'react-router-dom'

export default function QuickActionCard({ to, icon, title, description, tone = 'plum' }) {
  const body = (
    <>
      <span className="dash-action__icon" aria-hidden="true">{icon}</span>
      <span className="dash-action__copy">
        <span className="dash-action__title">{title}</span>
        <span className="dash-action__desc">{description}</span>
      </span>
      <span className="dash-action__arrow" aria-hidden="true">→</span>
    </>
  )

  if (!to) {
    return (
      <div className={`dash-action dash-action--${tone} dash-action--disabled`} aria-disabled="true">
        {body}
      </div>
    )
  }

  return (
    <Link to={to} className={`dash-action dash-action--${tone}`}>
      {body}
    </Link>
  )
}
