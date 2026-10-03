import { useState } from 'react'
import { formatPeso } from '../../utils/hotelUtils'

export default function CheckInPanel({ hotel, onCheckIn, loading }) {
  const [reservationId, setReservationId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const booked = (hotel?.reservations || []).filter((r) => r.status === 'booked')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      await onCheckIn({ reservation_id: reservationId })
      setSuccess('Guest checked in. Room is now occupied.')
      setReservationId('')
    } catch (err) {
      const msg = err.response?.data?.errors
      const first = msg ? Object.values(msg).flat()[0] : 'Check-in failed.'
      setError(first)
    }
  }

  return (
    <div className="hotel-panel hotel-panel--workspace">
      <header className="hotel-panel__header">
        <h2 className="hotel-panel__title">Check in guest</h2>
        <p className="hotel-panel__subtitle">Select a booked reservation to assign the room.</p>
      </header>

      {booked.length === 0 ? (
        <p className="hotel-empty-state">No reservations waiting. Book a guest in step 1 first.</p>
      ) : (
        <form className="hotel-form hotel-form--sections" onSubmit={handleSubmit}>
          <section className="hotel-form-section">
            <h3 className="hotel-form-section__title">Waiting reservations</h3>
            <div className="hotel-pick-list">
              {booked.map((r) => (
                <label key={r.id} className={`hotel-pick-list__item${reservationId === r.id ? ' is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="reservation"
                    value={r.id}
                    checked={reservationId === r.id}
                    onChange={() => setReservationId(r.id)}
                  />
                  <span className="hotel-pick-list__body">
                    <strong>{r.guest_first_name} {r.guest_last_name}</strong>
                    <span>Room {r.room_number} · {r.nights} night{r.nights === 1 ? '' : 's'} · {formatPeso(r.total)}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          {error && <p className="hotel-error" role="alert">{error}</p>}
          {success && <p className="hotel-success" role="status">{success}</p>}

          <div className="hotel-form__actions">
            <button type="submit" className="hotel-btn hotel-btn--purple" disabled={loading || !reservationId}>
              {loading ? 'Checking in…' : 'Check in selected guest'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
