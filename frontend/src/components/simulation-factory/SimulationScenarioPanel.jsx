import { useMemo, useState } from 'react'
import { formatPeso, rateLabel } from '../../utils/hotelUtils'

const SCENARIO_TABS = [
  { id: 'briefing', label: 'Briefing', hint: 'What students read' },
  { id: 'booking', label: 'Booking', hint: 'Correct reservation' },
  { id: 'checkout', label: 'Check-out', hint: 'Payment & steps' },
]

export default function SimulationScenarioPanel({ config, onChange }) {
  const [activeTab, setActiveTab] = useState('briefing')

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

  const activeIndex = SCENARIO_TABS.findIndex((t) => t.id === activeTab)

  return (
    <div className="sim-scenario-config">
      <div className="sim-scenario-summary">
        <p className="sim-scenario-summary__title">Scenario overview</p>
        <ul className="sim-scenario-summary__list">
          <li>
            <span>Guest</span>
            <strong>
              {guest.first_name || guest.last_name
                ? `${guest.first_name || '—'} ${guest.last_name || ''}`.trim()
                : 'Not set'}
            </strong>
          </li>
          <li>
            <span>Room</span>
            <strong>
              {reservation.room_number
                ? `Room ${reservation.room_number}${selectedType ? ` · ${selectedType.label}` : ''}`
                : 'Not set'}
            </strong>
          </li>
          <li>
            <span>Expected bill</span>
            <strong>{expectedTotal != null ? formatPeso(expectedTotal) : '—'}</strong>
          </li>
        </ul>
      </div>

      <nav className="sim-scenario-tabs" aria-label="Scenario sections">
        {SCENARIO_TABS.map((tab, i) => (
          <button
            key={tab.id}
            type="button"
            className={`sim-scenario-tabs__btn${activeTab === tab.id ? ' is-active' : ''}${i < activeIndex ? ' is-done' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="sim-scenario-tabs__num">{i + 1}</span>
            <span className="sim-scenario-tabs__text">
              <span className="sim-scenario-tabs__label">{tab.label}</span>
              <span className="sim-scenario-tabs__hint">{tab.hint}</span>
            </span>
          </button>
        ))}
      </nav>

      <div className="sim-scenario-panel">
        {activeTab === 'briefing' && (
          <section className="sim-scenario-config__section">
            <h3 className="sim-scenario-panel__title">Student briefing</h3>
            <p className="sim-hotel-config__help">
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
            <div className="sim-scenario-nav-hint">
              Next: set the <strong>correct booking details</strong> students must enter.
            </div>
          </section>
        )}

        {activeTab === 'booking' && (
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

        {activeTab === 'checkout' && (
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

      <footer className="sim-scenario-footer">
        <button
          type="button"
          className="af-btn af-btn--ghost"
          disabled={activeIndex <= 0}
          onClick={() => setActiveTab(SCENARIO_TABS[activeIndex - 1].id)}
        >
          Previous section
        </button>
        <button
          type="button"
          className="af-btn af-btn--ghost"
          disabled={activeIndex >= SCENARIO_TABS.length - 1}
          onClick={() => setActiveTab(SCENARIO_TABS[activeIndex + 1].id)}
        >
          Next section
        </button>
      </footer>
    </div>
  )
}
