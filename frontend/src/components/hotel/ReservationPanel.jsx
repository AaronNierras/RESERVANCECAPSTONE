import { useMemo, useState } from 'react'
import {
  estimateStayTotal,
  formatPeso,
  rateLabel,
  roomTypeOptionLabel,
} from '../../utils/hotelUtils'

const emptyForm = () => ({
  guest_last_name: '',
  guest_first_name: '',
  phone: '',
  arrival_date: new Date().toISOString().slice(0, 10),
  nights: 2,
  guests: 2,
  room_type: '',
  room_number: '',
  rate_type: 'rack',
})

export default function ReservationPanel({ hotel, onBook, loading }) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const roomTypes = hotel?.room_types || []

  const selectedType = useMemo(
    () => roomTypes.find((t) => t.code === form.room_type),
    [roomTypes, form.room_type],
  )

  const availableRooms = useMemo(
    () => (hotel?.rooms || []).filter((r) => r.status === 'available'),
    [hotel?.rooms],
  )

  const filteredRooms = availableRooms.filter(
    (r) => !form.room_type || r.room_type === form.room_type,
  )

  const estimatedTotal = useMemo(
    () => estimateStayTotal(selectedType, form.rate_type, form.nights),
    [selectedType, form.rate_type, form.nights],
  )

  const nightlyRate = selectedType?.rates?.[form.rate_type]

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      await onBook(form)
      setSuccess('Reservation saved. You can check the guest in from step 2.')
      setForm(emptyForm())
    } catch (err) {
      const msg = err.response?.data?.errors
      const first = msg ? Object.values(msg).flat()[0] : 'Booking failed.'
      setError(first)
    }
  }

  return (
    <div className="hotel-panel hotel-panel--workspace">
      <header className="hotel-panel__header">
        <h2 className="hotel-panel__title">Book a reservation</h2>
        <p className="hotel-panel__subtitle">Fill in guest details, stay dates, then pick a room and price.</p>
      </header>

      <form className="hotel-form hotel-form--sections" onSubmit={handleSubmit}>
        <section className="hotel-form-section">
          <h3 className="hotel-form-section__title">Guest information</h3>
          <div className="hotel-form__row">
            <div className="hotel-field">
              <label htmlFor="guest-last">Last name</label>
              <input id="guest-last" value={form.guest_last_name} onChange={(e) => set('guest_last_name', e.target.value)} required />
            </div>
            <div className="hotel-field">
              <label htmlFor="guest-first">First name</label>
              <input id="guest-first" value={form.guest_first_name} onChange={(e) => set('guest_first_name', e.target.value)} required />
            </div>
          </div>
          <div className="hotel-field">
            <label htmlFor="guest-phone">Phone number</label>
            <input id="guest-phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="e.g. 09171234567" required />
          </div>
        </section>

        <section className="hotel-form-section">
          <h3 className="hotel-form-section__title">Stay details</h3>
          <div className="hotel-form__row">
            <div className="hotel-field">
              <label htmlFor="arrival">Check-in date</label>
              <input id="arrival" type="date" value={form.arrival_date} onChange={(e) => set('arrival_date', e.target.value)} required />
            </div>
            <div className="hotel-field">
              <label htmlFor="nights">Number of nights</label>
              <input id="nights" type="number" min={1} max={30} value={form.nights} onChange={(e) => set('nights', Number(e.target.value))} required />
            </div>
          </div>
          <div className="hotel-field hotel-field--narrow">
            <label htmlFor="guests">Number of guests</label>
            <input id="guests" type="number" min={1} max={20} value={form.guests} onChange={(e) => set('guests', Number(e.target.value))} required />
          </div>
        </section>

        <section className="hotel-form-section">
          <h3 className="hotel-form-section__title">Room &amp; rate</h3>
          <div className="hotel-field">
            <label htmlFor="room-type">Room category</label>
            <select
              id="room-type"
              value={form.room_type}
              onChange={(e) => {
                set('room_type', e.target.value)
                set('room_number', '')
              }}
              required
            >
              <option value="">Choose a room type…</option>
              {roomTypes.map((t) => (
                <option key={t.code} value={t.code}>{roomTypeOptionLabel(t)}</option>
              ))}
            </select>
          </div>

          <div className="hotel-form__row">
            <div className="hotel-field">
              <label htmlFor="room-num">Room number</label>
              <select id="room-num" value={form.room_number} onChange={(e) => set('room_number', e.target.value)} required>
                <option value="">{form.room_type ? 'Pick an available room…' : 'Select room type first'}</option>
                {filteredRooms.map((r) => (
                  <option key={r.number} value={r.number}>Room {r.number}</option>
                ))}
              </select>
            </div>
            <div className="hotel-field">
              <label htmlFor="rate-type">Price to use</label>
              <select id="rate-type" value={form.rate_type} onChange={(e) => set('rate_type', e.target.value)} required>
                <option value="rack">{rateLabel('rack')}</option>
                <option value="discount">{rateLabel('discount')}</option>
              </select>
              <span className="hotel-field__hint">Regular = full price. Promo = discounted nightly rate.</span>
            </div>
          </div>

          {selectedType && nightlyRate != null && (
            <div className="hotel-rate-summary" role="status">
              <div className="hotel-rate-summary__row">
                <span>Nightly rate ({rateLabel(form.rate_type)})</span>
                <strong>{formatPeso(nightlyRate)}</strong>
              </div>
              <div className="hotel-rate-summary__row hotel-rate-summary__row--total">
                <span>Estimated stay total ({form.nights} night{form.nights === 1 ? '' : 's'})</span>
                <strong>{formatPeso(estimatedTotal)}</strong>
              </div>
            </div>
          )}
        </section>

        {error && <p className="hotel-error" role="alert">{error}</p>}
        {success && <p className="hotel-success" role="status">{success}</p>}

        <div className="hotel-form__actions">
          <button type="submit" className="hotel-btn hotel-btn--gold" disabled={loading}>
            {loading ? 'Saving…' : 'Confirm reservation'}
          </button>
        </div>
      </form>
    </div>
  )
}
