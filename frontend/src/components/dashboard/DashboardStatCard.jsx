export default function DashboardStatCard({ icon, label, value, hint, tone = 'plum', breakdown }) {
  return (
    <article className={`dash-stat dash-stat--${tone}`}>
      {breakdown?.length ? (
        <div className="dash-stat__icon-wrap">
          <button type="button" className="dash-stat__icon" aria-label={`${label} breakdown`}>
            {icon}
          </button>
          <div className="dash-stat__tip" role="tooltip">
            {breakdown.map((item) => (
              <p key={item.label} className="dash-stat__tip-row">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </p>
            ))}
          </div>
        </div>
      ) : (
        <div className="dash-stat__icon" aria-hidden="true">{icon}</div>
      )}
      <p className="dash-stat__label">{label}</p>
      <p className="dash-stat__value">{value}</p>
      {hint && <p className="dash-stat__hint">{hint}</p>}
    </article>
  )
}
