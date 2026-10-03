const ACTION_LABELS = {
  login: 'Signed in',
  logout: 'Signed out',
  register_student: 'Student account created',
  update_student: 'Student account updated',
  register_faculty: 'Faculty account created',
  update_faculty: 'Faculty account updated',
  create_activity: 'Activity created',
  update_activity: 'Activity updated',
  publish_activity: 'Activity published',
  open_activity: 'Activity opened',
  close_activity: 'Activity closed',
  delete_activity: 'Activity deleted',
  duplicate_activity: 'Activity duplicated',
  copy_faculty_activity: 'Faculty activity copied',
  complete_academic_period: 'Academic period completed',
}

function formatWhen(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function labelFor(action) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action]
  return String(action || 'System event').replaceAll('_', ' ')
}

export default function RecentActivity({ items = [], page = 1, lastPage = 1, total = 0, onPageChange }) {
  const list = Array.isArray(items) ? items : (Array.isArray(items?.data) ? items.data : [])
  const start = total === 0 ? 0 : (page - 1) * 50 + 1
  const end = total === 0 ? 0 : start + list.length - 1

  return (
    <details className="dash-accordion">
      <summary className="dash-accordion__summary">Recent activity</summary>
      <div className="dash-accordion__body">
        {list.length === 0 ? (
          <div className="dash-empty-state">
            <p className="dash-empty-state__title">No recent activity</p>
            <p className="dash-empty-state__text">Program Chair activity will appear here.</p>
          </div>
        ) : (
          <ul className="dash-feed">
            {list.map((item, index) => (
              <li key={`${item.created_at}-${item.action}-${index}`} className="dash-feed__item">
                <time className="dash-feed__time" dateTime={item.created_at}>{formatWhen(item.created_at)}</time>
                <div>
                  <p className="dash-feed__action">{labelFor(item.action)}</p>
                  <p className="dash-feed__user">{item.user || 'Program Chair'}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {lastPage > 1 && (
          <nav className="dash-pager" aria-label="Program Chair activity pages">
            <button
              type="button"
              className="dash-pager__btn"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </button>
            <p className="dash-pager__status">
              {start}–{end} of {total}
            </p>
            <button
              type="button"
              className="dash-pager__btn dash-pager__btn--primary"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= lastPage}
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </details>
  )
}
