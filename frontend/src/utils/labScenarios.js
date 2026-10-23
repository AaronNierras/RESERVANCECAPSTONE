export const LAB_SCENARIOS = [
  { key: 'reservations', number: 1, title: 'Taking and Processing Reservations', points: 15, range: '6 / 4 / 3 / 2', playable: true },
  { key: 'check_in', number: 2, title: 'Guest Registration and Check-in', points: 20, range: '8 / 6 / 4 / 2', playable: true },
  { key: 'guest_services', number: 3, title: 'Guest Services and Telephone Handling', points: 15, range: '6 / 4 / 3 / 2', playable: false },
  { key: 'complaints', number: 4, title: 'Handling Guest Complaints', points: 15, range: '6 / 4 / 3 / 2', playable: false },
  { key: 'cashier', number: 5, title: 'Front Office Cashiering and Check-out', points: 20, range: '8 / 6 / 4 / 2', playable: true },
  { key: 'night_audit', number: 6, title: 'Night Audit and Reports', points: 15, range: '6 / 4 / 3 / 2', playable: false },
]

export const SCENARIO_ACTIONS = [
  { value: 'reservations', label: 'Book the reservation' },
  { value: 'check_in', label: 'Check the guest in' },
  { value: 'cashier', label: 'Compute the bill and check out' },
  { value: 'instruction', label: 'Follow this instruction (you score it)' },
]

export const MAX_SCENARIOS = 12

export function scenarioCatalog(key) {
  return LAB_SCENARIOS.find((item) => item.key === key) || LAB_SCENARIOS[0]
}

export function blankScenario(task = 'reservations', action = 'instruction') {
  const catalog = scenarioCatalog(task)
  return {
    id: `scn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: '',
    instruction: '',
    image_url: '',
    image_path: '',
    task: catalog.key,
    action,
  }
}

export function normalizeScenarioRows(scenarios = []) {
  return (scenarios || []).map((row, index) => {
    if (!row || typeof row !== 'object') return null
    const task = row.task || row.key || 'reservations'
    const catalog = scenarioCatalog(task)
    const action = row.action || (catalog.playable ? task : 'instruction')
    if (row.included === false && !row.action) return null
    return {
      id: row.id || `${catalog.key}-${index}`,
      title: row.title ?? (row.key ? catalog.title : ''),
      instruction: row.instruction || '',
      image_url: row.image_url || '',
      image_path: row.image_path || '',
      task: catalog.key,
      action: SCENARIO_ACTIONS.some((item) => item.value === action) ? action : 'instruction',
    }
  }).filter(Boolean)
}

export function defaultScenarioScoring() {
  return {
    tries: 3,
    deduction: 2,
    manual_computation: true,
    scenarios: [
      { id: 'reservations', task: 'reservations', action: 'reservations', title: 'Taking and Processing Reservations', instruction: 'Take the reservation from the briefing and compute the stay total yourself.', image_url: '', image_path: '' },
      { id: 'check_in', task: 'check_in', action: 'check_in', title: 'Guest Registration and Check-in', instruction: 'Register the same guest and assign the room from the briefing.', image_url: '', image_path: '' },
      { id: 'guest_services', task: 'guest_services', action: 'instruction', title: 'Guest Services and Telephone Handling', instruction: 'Follow the guest-service instruction on this card.', image_url: '', image_path: '' },
      { id: 'complaints', task: 'complaints', action: 'instruction', title: 'Handling Guest Complaints', instruction: 'Follow the complaint instruction on this card.', image_url: '', image_path: '' },
      { id: 'cashier', task: 'cashier', action: 'cashier', title: 'Front Office Cashiering and Check-out', instruction: 'Compute the bill yourself, then collect the correct payment.', image_url: '', image_path: '' },
    ],
  }
}
