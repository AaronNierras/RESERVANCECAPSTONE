export const RATE_LABELS = {
  rack: 'Regular price',
  discount: 'Promo price',
}

export function formatPeso(amount) {
  const n = Number(amount) || 0
  return `₱${n.toLocaleString('en-PH')}`
}

export function rateLabel(rateType) {
  return RATE_LABELS[rateType] || rateType
}

export function roomTypeOptionLabel(type) {
  if (!type) return ''
  const regular = type.rates?.rack
  const promo = type.rates?.discount
  let prices = ''
  if (regular != null) prices += `${formatPeso(regular)}/night regular`
  if (promo != null) prices += ` · ${formatPeso(promo)}/night promo`
  return `${type.label} (max ${type.max_guests} guests) — ${prices}`
}

export function estimateStayTotal(roomType, rateType, nights) {
  const rate = roomType?.rates?.[rateType]
  if (rate == null) return null
  return rate * (Number(nights) || 1)
}
