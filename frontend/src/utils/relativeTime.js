export function formatRelativeTime(isoString) {
  if (!isoString) return '—'

  const date = new Date(isoString)
  const diffMs = date.getTime() - Date.now()
  const absSec = Math.round(Math.abs(diffMs) / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (absSec < 60) return rtf.format(Math.round(diffMs / 1000), 'second')
  if (absSec < 3600) return rtf.format(Math.round(diffMs / 60000), 'minute')
  if (absSec < 86400) return rtf.format(Math.round(diffMs / 3600000), 'hour')
  if (absSec < 604800) return rtf.format(Math.round(diffMs / 86400000), 'day')

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(isoString) {
  if (!isoString) return '—'

  return new Date(isoString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
