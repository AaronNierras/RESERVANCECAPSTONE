import { formatPeso, rateLabel } from '../../utils/hotelUtils'

const STATUS_LABELS = {
  available: 'Available',
  booked: 'Booked',
  occupied: 'Occupied',
}

export default function RoomBoard({ rooms = [], roomTypes = [] }) {
  const typeInfo = (code) => roomTypes.find((t) => t.code === code)

  return (
    <div className="hotel-sidebar-card">
      <h2 className="hotel-sidebar-card__title">Room board</h2>
      <p className="hotel-sidebar-card__hint">Colors show each room&apos;s status. Rates are listed below.</p>

      <div className="hotel-room-grid hotel-room-grid--compact">
        {rooms.map((room) => {
          const type = typeInfo(room.room_type)
          return (
            <div
              key={room.number}
              className={`hotel-room hotel-room--${room.status || 'available'}`}
              title={`${type?.label || room.room_type} · ${STATUS_LABELS[room.status] || room.status}`}
            >
              <span className="hotel-room__num">{room.number}</span>
              <span className="hotel-room__type">{type?.label || room.room_type}</span>
            </div>
          )
        })}
      </div>

      <div className="hotel-legend hotel-legend--compact">
        <span className="hotel-legend__item"><span className="hotel-legend__dot hotel-legend__dot--avail" /> Available</span>
        <span className="hotel-legend__item"><span className="hotel-legend__dot hotel-legend__dot--booked" /> Booked</span>
        <span className="hotel-legend__item"><span className="hotel-legend__dot hotel-legend__dot--occupied" /> Occupied</span>
      </div>

      {roomTypes.length > 0 && (
        <div className="hotel-rate-guide">
          <h3 className="hotel-rate-guide__title">Room rates (per night)</h3>
          <ul className="hotel-rate-guide__list">
            {roomTypes.map((type) => (
              <li key={type.code} className="hotel-rate-guide__item">
                <span className="hotel-rate-guide__name">{type.label}</span>
                <span className="hotel-rate-guide__prices">
                  {type.rates?.rack != null && (
                    <span>{rateLabel('rack')}: {formatPeso(type.rates.rack)}</span>
                  )}
                  {type.rates?.discount != null && (
                    <span>{rateLabel('discount')}: {formatPeso(type.rates.discount)}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
