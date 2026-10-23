import { useEffect, useState } from 'react'
import { ASSESSMENT_TYPES, STATUS_META, audienceSummary } from '../../utils/activityFactory'

const PAGE_SIZE = 5

function typeLabel(type) {
  return ASSESSMENT_TYPES.find((item) => item.value === type)?.label || type || 'Assessment'
}

function formatWhen(value) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function sizeLabel(activity) {
  const count = activity.question_count || activity.questions?.length || 0
  if (activity.type === 'simulation') {
    return { label: 'Rooms', value: count }
  }
  if (activity.type === 'combination') {
    const rooms = activity.simulation_config?.rooms?.length || 0
    return { label: 'Parts', value: `${count} questions, ${rooms} rooms` }
  }
  return { label: count === 1 ? 'Question' : 'Questions', value: count }
}

function matchesTitle(activity, query) {
  const title = (activity.title || '').toLowerCase()
  return title.includes(query.trim().toLowerCase())
}

function ActivityCard({ activity, programs, actions, showSchedule }) {
  const tone = STATUS_META[activity.status]?.tone || 'muted'
  const size = sizeLabel(activity)
  const attempts = activity.attempt_count ?? 0

  return (
    <article className="af-card">
      <header className="af-card__head">
        <h3 className="af-card__title">{activity.title || 'Untitled draft'}</h3>
        <span className={`af-badge af-badge--${tone}`}>
          {activity.status === 'published' && activity.open_mode === 'automatic'
            ? 'Scheduled'
            : (STATUS_META[activity.status]?.label || activity.status)}
        </span>
      </header>
      <dl className="af-card__facts">
        <div>
          <dt>Type</dt>
          <dd>{typeLabel(activity.type)}</dd>
        </div>
        <div>
          <dt>{size.label}</dt>
          <dd>{size.value}</dd>
        </div>
        <div>
          <dt>Audience</dt>
          <dd>{audienceSummary(activity, programs)}</dd>
        </div>
        {showSchedule && (
          <div>
            <dt>{attempts === 1 ? 'Attempt' : 'Attempts'}</dt>
            <dd>{attempts}</dd>
          </div>
        )}
      </dl>
      {showSchedule && (
        <div className="af-card__schedule">
          <p><span>Starts</span> {formatWhen(activity.starts_at)}</p>
          <p><span>Ends</span> {formatWhen(activity.ends_at)}</p>
        </div>
      )}
      {actions}
    </article>
  )
}

function ListPager({ page, total, onPageChange, label, pageSize = PAGE_SIZE }) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <nav className="af-pager" aria-label={`${label} pages`}>
      <button type="button" className="af-pager__btn" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        Previous
      </button>
      <p className="af-pager__status">{start}–{end} of {total}</p>
      <button type="button" className="af-pager__btn af-pager__btn--primary" onClick={() => onPageChange(page + 1)} disabled={page >= lastPage}>
        Next
      </button>
    </nav>
  )
}

function ActivityGroup({
  title,
  hint,
  items,
  emptyText,
  programs,
  renderActions,
  showSchedule,
  page,
  onPageChange,
  accent,
  embedded,
  pageSize = PAGE_SIZE,
}) {
  const lastPage = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(page, lastPage)
  const visible = items.slice((current - 1) * pageSize, current * pageSize)
  const body = (
    <div className={`af-workspace-body${embedded ? ' af-list-swap' : ''}`} key={embedded ? title : undefined}>
        {items.length === 0 ? (
          <div className="af-empty">{emptyText}</div>
        ) : (
          <div className="af-cards">
            {visible.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                programs={programs}
                showSchedule={showSchedule}
                actions={renderActions(activity)}
              />
            ))}
          </div>
        )}
        <ListPager page={current} total={items.length} onPageChange={onPageChange} label={title || 'Assessments'} pageSize={pageSize} />
      </div>
  )

  if (embedded) return body

  return (
    <section className={`af-panel${accent ? ' af-panel--accent' : ''}`}>
      <div className="af-panel__head">
        <h2 className="af-section-title">{title}</h2>
        <p className="af-section-sub">{hint}</p>
      </div>
      {body}
    </section>
  )
}

export default function ActivityManagerPanel({
  activities,
  programs,
  onEditDraft,
  onPublish,
  onOpen,
  onClose,
  onDelete,
  onShare,
  onGrade,
}) {
  const [query, setQuery] = useState('')
  const [listView, setListView] = useState('open')
  const [pages, setPages] = useState({ drafts: 1, open: 1, ready: 1, closed: 1 })

  useEffect(() => {
    setPages({ drafts: 1, open: 1, ready: 1, closed: 1 })
  }, [query])

  const setPage = (key) => (page) => setPages((current) => ({ ...current, [key]: page }))

  const drafts = activities.filter((activity) => activity.status === 'draft')
  const searching = query.trim().length > 0
  const titled = (activity) => !searching || matchesTitle(activity, query)
  const openNow = activities.filter((activity) => activity.status === 'active' && titled(activity))
  const ready = activities.filter((activity) => activity.status === 'published' && titled(activity))
  const closed = activities.filter((activity) => activity.status === 'closed' && titled(activity))
  const noMatch = 'No assessments match that title.'
  const lists = {
    open: {
      title: 'Open now',
      hint: 'Students can attempt these.',
      items: openNow,
      emptyText: searching ? noMatch : 'No activities are open right now.',
    },
    ready: {
      title: 'Ready to open',
      hint: 'Published. Manual assessments wait here until you open them. Automatic assessments open at the start time.',
      items: ready,
      emptyText: searching ? noMatch : 'No assessments are waiting to be opened.',
    },
    closed: {
      title: 'Closed',
      hint: 'These assessments are no longer open.',
      items: closed,
      emptyText: searching ? noMatch : 'No closed assessments.',
    },
  }
  const activeList = lists[listView]

  const renderActions = (activity) => (
    <div className="af-card__actions">
      {activity.status === 'draft' && (
        <>
          <button type="button" className="af-btn af-btn--gold" onClick={() => onEditDraft(activity)}>Edit draft</button>
          <button type="button" className="af-btn af-btn--purple" onClick={() => onPublish(activity.id)}>Publish</button>
          {onShare && <button type="button" className="af-btn af-btn--ghost" onClick={() => onShare(activity)}>Share with faculty</button>}
          <button type="button" className="af-btn af-btn--danger" onClick={() => onDelete(activity.id)}>Delete</button>
        </>
      )}
      {activity.status === 'published' && activity.open_mode !== 'automatic' && (
        <>
          <button type="button" className="af-btn af-btn--gold" onClick={() => onOpen(activity.id)}>Open for students</button>
          <button type="button" className="af-btn af-btn--ghost" onClick={() => onClose(activity.id)}>Close</button>
        </>
      )}
      {activity.status === 'published' && activity.open_mode === 'automatic' && (
        <span className="af-card__meta">Opens automatically at the start time.</span>
      )}
      {(activity.status === 'active' || activity.status === 'closed') && (activity.type === 'simulation' || activity.type === 'combination') && onGrade && (
        <button type="button" className="af-btn af-btn--purple" onClick={() => onGrade(activity)}>Grade with rubric</button>
      )}
      {activity.status === 'active' && (
        <button type="button" className="af-btn af-btn--danger" onClick={() => onClose(activity.id)}>Close activity</button>
      )}
    </div>
  )

  return (
    <div className="af-hub">
      <ActivityGroup
        title="Saved drafts"
        hint="Resume unfinished assessments anytime."
        items={drafts}
        emptyText="No drafts yet. Start a new assessment to create one."
        programs={programs}
        renderActions={renderActions}
        page={pages.drafts}
        onPageChange={setPage('drafts')}
        accent
      />

      <section className="af-panel">
        <div className="af-panel__head">
          <div className="af-switch" role="tablist" aria-label="Assessment lists">
            {Object.entries(lists).map(([key, list]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={listView === key}
                className={`af-switch__btn${listView === key ? ' is-active' : ''}`}
                onClick={() => setListView(key)}
              >
                {list.title}
                <span>{list.items.length}</span>
              </button>
            ))}
          </div>
          <p className="af-section-sub">{activeList.hint}</p>
          <label className="af-search">
            <span>Search assessments</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title"
            />
          </label>
        </div>
        <ActivityGroup
          items={activeList.items}
          emptyText={activeList.emptyText}
          programs={programs}
          renderActions={renderActions}
          showSchedule
          page={pages[listView]}
          onPageChange={setPage(listView)}
          pageSize={10}
          embedded
        />
      </section>
    </div>
  )
}
