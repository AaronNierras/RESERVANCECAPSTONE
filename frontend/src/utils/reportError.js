export function reportClientError(message, location) {
  const text = String(message || 'Unexpected error').slice(0, 500)
  const friendly = /SQLSTATE|Integrity constraint/i.test(text)
    ? 'The assessment could not be saved because a question was still empty. Type the question text, then save again.'
    : text
  window.dispatchEvent(new CustomEvent('reservance-error', { detail: { message: friendly } }))
  if (localStorage.getItem('reservance_token')) {
    import('../api/client').then(({ default: client }) => {
      client.post('/system-errors', { message: text, location }).catch(() => {})
    }).catch(() => {})
  }
}
