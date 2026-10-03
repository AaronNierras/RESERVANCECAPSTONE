export default function LeaveConfirmModal({ open, onContinue, onSaveDraft, onExit }) {
  if (!open) return null

  return (
    <div className="af-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="af-leave-title">
      <div className="af-modal">
        <h3 id="af-leave-title">Unsaved changes</h3>
        <p>You have unsaved changes to this assessment.</p>
        <div className="af-modal__actions">
          <button type="button" className="af-btn af-btn--purple" onClick={onContinue}>Continue creating</button>
          <button type="button" className="af-btn af-btn--gold" onClick={onSaveDraft}>Save draft</button>
          <button type="button" className="af-btn af-btn--ghost" onClick={onExit}>Exit</button>
        </div>
      </div>
    </div>
  )
}
