export default function Modal({ open, title, onClose, children, footer, wide = false, xl = false, accessible = false }) {
  if (!open) return null

  const panelClass = [
    'modal-panel',
    wide && 'modal-panel--wide',
    xl && 'modal-panel--xl',
    accessible && 'modal-panel--accessible',
  ].filter(Boolean).join(' ')

  return (
    <div className="modal-root" role="presentation" onClick={onClose}>
      <div
        className={panelClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-panel__head">
          <h2 id="modal-title" className="modal-panel__title">{title}</h2>
          <button type="button" className="modal-panel__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="modal-panel__body">{children}</div>
        {footer && <footer className="modal-panel__foot">{footer}</footer>}
      </div>
    </div>
  )
}
