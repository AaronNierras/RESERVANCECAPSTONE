import { formatPeso, rateLabel } from '../../utils/hotelUtils'

export default function SimulationHotelPanel({ config, onChange }) {
  const roomTypes = config.room_types || []
  const rooms = config.rooms || []

  const update = (patch) => onChange({ ...config, ...patch })

  const updateRoomType = (index, patch) => {
    const next = roomTypes.map((rt, i) => (i === index ? { ...rt, ...patch } : rt))
    update({ room_types: next })
  }

  const addRoomType = () => {
    update({
      room_types: [
        ...roomTypes,
        { code: `T${roomTypes.length + 1}`, label: 'New Type', max_guests: 2, rates: { rack: 2000, discount: 1500 } },
      ],
    })
  }

  const removeRoomType = (index) => {
    if (roomTypes.length <= 1) return
    update({ room_types: roomTypes.filter((_, i) => i !== index) })
  }

  const updateRoom = (index, patch) => {
    const next = rooms.map((r, i) => (i === index ? { ...r, ...patch } : r))
    update({ rooms: next })
  }

  const addRoom = () => {
    update({
      rooms: [
        ...rooms,
        { number: String(100 + rooms.length + 1), room_type: roomTypes[0]?.code || 'STD', status: 'available' },
      ],
    })
  }

  const removeRoom = (index) => {
    update({ rooms: rooms.filter((_, i) => i !== index) })
  }

  return (
    <div className="sim-hotel-config">
      <div className="af-field">
        <label>Hotel name</label>
        <input
          className="af-input"
          value={config.hotel_name || ''}
          onChange={(e) => update({ hotel_name: e.target.value })}
          placeholder="e.g. RESERVANCE Grand Hotel"
        />
      </div>

      <section className="sim-hotel-config__section">
        <div className="sim-hotel-config__section-head">
          <div>
            <h3 className="af-section-title">Room types &amp; prices</h3>
            <p className="sim-hotel-config__help">
              Set the category name, guest limit, and nightly prices. Students see these as &quot;Regular&quot; and &quot;Promo&quot; rates.
            </p>
          </div>
          <button type="button" className="af-btn af-btn--ghost" onClick={addRoomType}>+ Add type</button>
        </div>

        <div className="sim-hotel-table-wrap">
          <table className="sim-hotel-table">
            <thead>
              <tr>
                <th>Short code</th>
                <th>Display name</th>
                <th>Max guests</th>
                <th>{rateLabel('rack')} (₱/night)</th>
                <th>{rateLabel('discount')} (₱/night)</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {roomTypes.map((rt, i) => (
                <tr key={i}>
                  <td>
                    <input className="af-input af-input--compact" value={rt.code} onChange={(e) => updateRoomType(i, { code: e.target.value })} />
                  </td>
                  <td>
                    <input className="af-input af-input--compact" value={rt.label} onChange={(e) => updateRoomType(i, { label: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" min={1} className="af-input af-input--compact" value={rt.max_guests} onChange={(e) => updateRoomType(i, { max_guests: Number(e.target.value) })} />
                  </td>
                  <td>
                    <input type="number" min={0} className="af-input af-input--compact" value={rt.rates?.rack ?? 0} onChange={(e) => updateRoomType(i, { rates: { ...rt.rates, rack: Number(e.target.value) } })} />
                  </td>
                  <td>
                    <input type="number" min={0} className="af-input af-input--compact" value={rt.rates?.discount ?? 0} onChange={(e) => updateRoomType(i, { rates: { ...rt.rates, discount: Number(e.target.value) } })} />
                  </td>
                  <td>
                    <button type="button" className="sim-hotel-table__remove" onClick={() => removeRoomType(i)} disabled={roomTypes.length <= 1}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {roomTypes.length > 0 && (
          <p className="sim-hotel-config__preview">
            Preview: {roomTypes.map((rt) => `${rt.label} — ${formatPeso(rt.rates?.rack ?? 0)} regular, ${formatPeso(rt.rates?.discount ?? 0)} promo`).join(' · ')}
          </p>
        )}
      </section>

      <section className="sim-hotel-config__section">
        <div className="sim-hotel-config__section-head">
          <div>
            <h3 className="af-section-title">Individual rooms</h3>
            <p className="sim-hotel-config__help">Assign each room number to a type. Starting status is usually &quot;Available&quot;.</p>
          </div>
          <button type="button" className="af-btn af-btn--ghost" onClick={addRoom}>+ Add room</button>
        </div>

        <div className="sim-hotel-table-wrap">
          <table className="sim-hotel-table">
            <thead>
              <tr>
                <th>Room #</th>
                <th>Room type</th>
                <th>Starting status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rooms.map((room, i) => (
                <tr key={i}>
                  <td>
                    <input className="af-input af-input--compact" value={room.number} onChange={(e) => updateRoom(i, { number: e.target.value })} />
                  </td>
                  <td>
                    <select className="af-select af-input--compact" value={room.room_type} onChange={(e) => updateRoom(i, { room_type: e.target.value })}>
                      {roomTypes.map((rt) => <option key={rt.code} value={rt.code}>{rt.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="af-select af-input--compact" value={room.status} onChange={(e) => updateRoom(i, { status: e.target.value })}>
                      <option value="available">Available</option>
                      <option value="booked">Booked</option>
                      <option value="occupied">Occupied</option>
                    </select>
                  </td>
                  <td>
                    <button type="button" className="sim-hotel-table__remove" onClick={() => removeRoom(i)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
