export default function DashboardMetricCard({
  icon,
  label,
  value,
  status,
  progress,
  compact = false,
  featured = false,
}) {
  const percent =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : null

  const classes = [
    'dash-metric',
    compact && 'dash-metric--compact',
    featured && 'dash-metric--featured',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article className={classes}>
      <div className="dash-metric__head">
        <div className="dash-metric__icon" aria-hidden="true">
          {icon}
        </div>
        <p className="dash-metric__label">{label}</p>
      </div>
      <p className="dash-metric__value">{value}</p>
      {status && <p className="dash-metric__status">{status}</p>}
      {progress && (
        <div className="dash-metric__progress-wrap">
          <div className="dash-metric__progress-track" aria-hidden="true">
            <div
              className="dash-metric__progress-fill"
              style={{ width: `${Math.min(100, percent ?? 0)}%` }}
            />
          </div>
          <p className="dash-metric__progress-label">
            {progress.current} of {progress.total} online
            {percent !== null && <span className="dash-metric__progress-pct">{percent}%</span>}
          </p>
        </div>
      )}
    </article>
  )
}
