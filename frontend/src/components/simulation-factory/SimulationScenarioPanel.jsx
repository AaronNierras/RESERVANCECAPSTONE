import { useEffect, useMemo, useState } from 'react'
import { formatPeso, rateLabel } from '../../utils/hotelUtils'
import ScenarioNumberSheet, { defaultScenarioScoring } from './ScenarioNumberSheet'

const ANSWER_PANES = [
  { id: 'booking', label: 'Correct reservation', hint: 'Guest, room, and rate the system checks' },
  { id: 'checkout', label: 'Payment and steps', hint: 'Check-in, check-out, and the bill' },
]

export default function SimulationScenarioPanel({ config, onChange, onUploadImage, uploading }) {
  const [answerPane, setAnswerPane] = useState('booking')

  const scenario = config.scenario || {}
  const guest = scenario.guest || {}
  const reservation = scenario.reservation || {}
  const checkOut = scenario.check_out || {}
  const roomTypes = config.room_types || []
  const rooms = config.rooms || []

  const selectedType = roomTypes.find((t) => t.code === reservation.room_type)
  const selectedRoom = rooms.find((r) => r.number === reservation.room_number)

  const expectedTotal = useMemo(() => {
    const rate = selectedType?.rates?.[reservation.rate_type || 'rack']
    if (rate == null) return null
    return rate * (reservation.nights ?? 1)
  }, [selectedType, reservation.rate_type, reservation.nights])

  const updateScenario = (patch) => onChange({
    ...config,
    scenario: { ...scenario, ...patch },
  })

  useEffect(() => {
    if (!scenario.scoring) {
      updateScenario({ scoring: defaultScenarioScoring() })
    }
  }, [])

  const applyCalculatedTotal = () => {
    if (expectedTotal == null) return
    updateScenario({
      check_out: {
        ...checkOut,
        required: true,
        folio_total: expectedTotal,
        amount_tendered: expectedTotal,
      },
    })
  }

  const guestLabel = guest.first_name || guest.last_name
    ? `${guest.first_name || ''} ${guest.last_name || ''}`.trim()
    : 'Not set'

  return (
    <div className="sim-scenario-config">
      <section className="sim-scenario-briefing">
        <h3>Student briefing</h3>
        <p>
          This is the only scenario text students see before they start. Describe the guest and what they need to do — do not include the answer key here.
        </p>
        <div className="af-field">
          <label htmlFor="scenario-briefing">Briefing text</label>
          <textarea
            id="scenario-briefing"
            className="af-textarea"
            rows={5}
            value={scenario.briefing || ''}
            onChange={(e) => updateScenario({ briefing: e.target.value })}
            placeholder="Example: Maria Santos will arrive today. She needs a Deluxe room for 2 nights. Book her stay, check her in, then check her out with cash."
          />
        </div>
      </section>

      <ScenarioNumberSheet
        scoring={scenario.scoring}
        onChange={(scoring) => updateScenario({ scoring })}
        onUploadImage={onUploadImage}
        uploading={uploading}
      />

      <section className="sim-answer-key">
        <header className="sim-answer-key__head">
          <div>
            <h3>Answer key</h3>
            <p>Students never see this. Pick one side to edit. The other side stays saved.</p>
          </div>
          <ul className="sim-scenario-summary__list">
            <li><span>Guest</span><strong>{guestLabel}</strong></li>
            <li>
              <span>Room</span>
              <strong>
                {reservation.room_number
                  ? `Room ${reservation.room_number}${selectedType ? ` · ${selectedType.label}` : ''}`
                  : 'Not set'}
              </strong>
            </li>
            <li><span>Expected bill</span><strong>{expectedTotal != null ? formatPeso(expectedTotal) : '—'}</strong></li>
          </ul>
        </header>

        <div className="sim-answer-key__split">
          <nav className="sim-answer-key__nav" aria-label="Answer key">
            {ANSWER_PANES.map((pane) => (
              <button
                key={pane.id}
                type="button"
                className={`sim-answer-key__choice${answerPane === pane.id ? ' is-active' : ''}`}
                aria-pressed={answerPane === pane.id}
                onClick={() => setAnswerPane(pane.id)}
              >
                <strong>{pane.label}</strong>
                <span>{pane.hint}</span>
              </button>
            ))}
          </nav>

          <div className="sim-scenario-panel">
        {answerPane === 'booking' && (
          <section className="sim-scenario-config__section">
            <h3 className="sim-scenario-panel__title">Correct booking (answer key)</h3>
            <p className="sim-hotel-config__help">
              These are the exact details the system will grade against when the student makes a reservation.
            </p>

            <div className="sim-scenario-block">
              <h4 className="sim-scenario-block__title">Guest</h4>
              <div className="af-form-grid af-form-grid--2">
                <div className="af-field">
                  <label>First name</label>
                  <input className="af-input" value={guest.first_name || ''} onChange={(e) => updateScenario({ guest: { ...guest, first_name: e.target.value } })} />
                </div>
                <div className="af-field">
                  <label>Last name</label>
                  <input className="af-input" value={guest.last_name || ''} onChange={(e) => updateScenario({ guest: { ...guest, last_name: e.target.value } })} />
                </div>
                <div className="af-field af-form-grid__full">
                  <label>Phone</label>
                  <input className="af-input" value={guest.phone || ''} onChange={(e) => updateScenario({ guest: { ...guest, phone: e.target.value } })} placeholder="09171234567" />
                </div>
              </div>
            </div>

            <div className="sim-scenario-block">
              <h4 className="sim-scenario-block__title">Stay</h4>
              <div className="af-form-grid sim-form-grid--3">
                <div className="af-field">
                  <label>Check-in date</label>
                  <input type="date" className="af-input" value={reservation.arrival_date || ''} onChange={(e) => updateScenario({ reservation: { ...reservation, arrival_date: e.target.value } })} />
                </div>
                <div className="af-field">
                  <label>Nights</label>
                  <input type="number" min={1} className="af-input" value={reservation.nights ?? 1} onChange={(e) => updateScenario({ reservation: { ...reservation, nights: Number(e.target.value) } })} />
                </div>
                <div className="af-field">
                  <label>Guests</label>
                  <input type="number" min={1} className="af-input" value={reservation.guests ?? 1} onChange={(e) => updateScenario({ reservation: { ...reservation, guests: Number(e.target.value) } })} />
                </div>
              </div>
            </div>

            <div className="sim-scenario-block">
              <h4 className="sim-scenario-block__title">Room &amp; price</h4>
              <div className="af-form-grid af-form-grid--2">
                <div className="af-field">
                  <label>Room type</label>
                  <select
                    className="af-select"
                    value={reservation.room_type || ''}
                    onChange={(e) => updateScenario({
                      reservation: { ...reservation, room_type: e.target.value, room_number: '' },
                    })}
                  >
                    <option value="">Choose type…</option>
                    {roomTypes.map((rt) => (
                      <option key={rt.code} value={rt.code}>
                        {rt.label} — {formatPeso(rt.rates?.rack ?? 0)} regular
                      </option>
                    ))}
                  </select>
                </div>
                <div className="af-field">
                  <label>Room number</label>
                  <select className="af-select" value={reservation.room_number || ''} onChange={(e) => updateScenario({ reservation: { ...reservation, room_number: e.target.value } })}>
                    <option value="">{reservation.room_type ? 'Choose room…' : 'Pick room type first'}</option>
                    {rooms
                      .filter((r) => !reservation.room_type || r.room_type === reservation.room_type)
                      .map((r) => (
                        <option key={r.number} value={r.number}>Room {r.number}</option>
                      ))}
                  </select>
                </div>
                <div className="af-field">
                  <label>Price to charge</label>
                  <select className="af-select" value={reservation.rate_type || 'rack'} onChange={(e) => updateScenario({ reservation: { ...reservation, rate_type: e.target.value } })}>
                    <option value="rack">{rateLabel('rack')}</option>
                    <option value="discount">{rateLabel('discount')}</option>
                  </select>
                </div>
              </div>

              {expectedTotal != null && (
                <div className="sim-hotel-config__preview">
                  Expected stay total: <strong>{formatPeso(expectedTotal)}</strong>
                  {selectedRoom && ` · Room ${selectedRoom.number}`}
                  {' '}({reservation.nights ?? 1} night(s) at {rateLabel(reservation.rate_type || 'rack')})
                </div>
              )}
            </div>
          </section>
        )}

        {answerPane === 'checkout' && (
          <section className="sim-scenario-config__section">
            <h3 className="sim-scenario-panel__title">Check-out &amp; workflow</h3>
            <p className="sim-hotel-config__help">
              Choose which front-desk steps students must complete, then set the expected payment if check-out is required.
            </p>

            <div className="sim-scenario-toggles">
              <label className="sim-scenario-toggle-card">
                <input
                  type="checkbox"
                  checked={Boolean(scenario.check_in?.required)}
                  onChange={(e) => updateScenario({ check_in: { required: e.target.checked } })}
                />
                <span>
                  <strong>Require check-in</strong>
                  <small>Student must check the guest into the room after booking.</small>
                </span>
              </label>
              <label className="sim-scenario-toggle-card">
                <input
                  type="checkbox"
                  checked={Boolean(checkOut.required)}
                  onChange={(e) => updateScenario({ check_out: { ...checkOut, required: e.target.checked } })}
                />
                <span>
                  <strong>Require check-out</strong>
                  <small>Student must collect payment and close the folio.</small>
                </span>
              </label>
            </div>

            {checkOut.required && (
              <div className="sim-scenario-block">
                <div className="sim-scenario-block__head">
                  <h4 className="sim-scenario-block__title">Expected payment</h4>
                  {expectedTotal != null && (
                    <button type="button" className="af-btn af-btn--ghost sim-scenario-btn-sm" onClick={applyCalculatedTotal}>
                      Use calculated total ({formatPeso(expectedTotal)})
                    </button>
                  )}
                </div>
                <div className="af-form-grid sim-form-grid--3">
                  <div className="af-field">
                    <label>Bill total (₱)</label>
                    <input type="number" min={0} className="af-input" value={checkOut.folio_total ?? 0} onChange={(e) => updateScenario({ check_out: { ...checkOut, folio_total: Number(e.target.value) } })} />
                  </div>
                  <div className="af-field">
                    <label>Payment method</label>
                    <select className="af-select" value={checkOut.payment_type || 'cash'} onChange={(e) => updateScenario({ check_out: { ...checkOut, payment_type: e.target.value } })}>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                    </select>
                  </div>
                  <div className="af-field">
                    <label>Amount tendered (₱)</label>
                    <input type="number" min={0} className="af-input" value={checkOut.amount_tendered ?? 0} onChange={(e) => updateScenario({ check_out: { ...checkOut, amount_tendered: Number(e.target.value) } })} />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
          </div>
        </div>
      </section>
    </div>
  )
}
