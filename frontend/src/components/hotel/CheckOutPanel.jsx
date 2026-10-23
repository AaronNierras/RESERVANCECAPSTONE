import { useMemo, useState } from 'react'
import { formatPeso, rateLabel } from '../../utils/hotelUtils'

export default function CheckOutPanel({ hotel, onCheckOut, loading }) {
  const [reservationId, setReservationId] = useState('')
  const [paymentType, setPaymentType] = useState('cash')
  const [amountTendered, setAmountTendered] = useState('')
  const [computedTotal, setComputedTotal] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const checkedIn = useMemo(
    () => (hotel?.reservations || []).filter((r) => r.status === 'checked_in'),
    [hotel?.reservations],
  )

  const selected = checkedIn.find((r) => r.id === reservationId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      await onCheckOut({
        reservation_id: reservationId,
        payment_type: paymentType,
        amount_tendered: Number(amountTendered),
        computed_total: hotel?.manual_computation ? Number(computedTotal) : undefined,
      })
      setSuccess('Guest checked out successfully.')
      setReservationId('')
      setAmountTendered('')
      setComputedTotal('')
    } catch (err) {
      const msg = err.response?.data?.errors
      const first = msg ? Object.values(msg).flat()[0] : 'Check-out failed.'
      setError(first)
    }
  }

  return (
    <div className="hotel-panel hotel-panel--workspace">
      <header className="hotel-panel__header">
        <h2 className="hotel-panel__title">Check out &amp; payment</h2>
        <p className="hotel-panel__subtitle">Select a checked-in guest, review the bill, then collect payment.</p>
      </header>

      {checkedIn.length === 0 ? (
        <p className="hotel-empty-state">No guests are checked in yet. Complete step 2 first.</p>
      ) : (
        <form className="hotel-form hotel-form--sections" onSubmit={handleSubmit}>
          <section className="hotel-form-section">
            <h3 className="hotel-form-section__title">Guest folio</h3>
            <div className="hotel-field">
              <label htmlFor="checkout-guest">Select guest</label>
              <select
                id="checkout-guest"
                value={reservationId}
                onChange={(e) => {
                  setReservationId(e.target.value)
                  if (hotel?.manual_computation) return
                  const res = checkedIn.find((r) => r.id === e.target.value)
                  if (res) setAmountTendered(String(res.total))
                }}
                required
              >
                <option value="">Choose a guest…</option>
                {checkedIn.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.guest_first_name} {r.guest_last_name} — Room {r.room_number}{hotel?.manual_computation ? '' : ` (${formatPeso(r.total)})`}
                  </option>
                ))}
              </select>
            </div>

            {selected && !hotel?.manual_computation && (
              <div className="hotel-rate-summary">
                <div className="hotel-rate-summary__row">
                  <span>Room {selected.room_number} · {selected.nights} night{selected.nights === 1 ? '' : 's'}</span>
                  <strong>{rateLabel(selected.rate_type)}</strong>
                </div>
                <div className="hotel-rate-summary__row hotel-rate-summary__row--total">
                  <span>Amount due</span>
                  <strong>{formatPeso(selected.total)}</strong>
                </div>
              </div>
            )}
            {selected && hotel?.manual_computation && (
              <div className="hotel-field">
                <label htmlFor="computed-bill">Bill you computed</label>
                <input
                  id="computed-bill"
                  type="number"
                  min={0}
                  step="0.01"
                  value={computedTotal}
                  onChange={(e) => setComputedTotal(e.target.value)}
                  required
                />
                <span className="hotel-field__hint">
                  Room {selected.room_number} · {selected.nights} night{selected.nights === 1 ? '' : 's'} · {rateLabel(selected.rate_type)}. Enter the total you calculated.
                </span>
              </div>
            )}
          </section>

          <section className="hotel-form-section">
            <h3 className="hotel-form-section__title">Payment</h3>
            <div className="hotel-form__row">
              <div className="hotel-field">
                <label htmlFor="pay-type">Payment method</label>
                <select id="pay-type" value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <div className="hotel-field">
                <label htmlFor="pay-amount">Amount tendered</label>
                <input
                  id="pay-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amountTendered}
                  onChange={(e) => setAmountTendered(e.target.value)}
                  required
                />
              </div>
            </div>
          </section>

          {error && <p className="hotel-error" role="alert">{error}</p>}
          {success && <p className="hotel-success" role="status">{success}</p>}

          <div className="hotel-form__actions">
            <button type="submit" className="hotel-btn hotel-btn--gold" disabled={loading || !reservationId}>
              {loading ? 'Processing…' : 'Complete check-out'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
