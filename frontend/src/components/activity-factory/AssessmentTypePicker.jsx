const SYMBOLS = {
  activity: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="13" y="9" width="22" height="30" rx="3" />
      <path d="M19 19h10M19 26h10M19 33h6" />
    </svg>
  ),
  quiz: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="13" />
      <path d="M19 20a5 5 0 1 1 6 4.4c-.9.6-1.2 1.2-1.2 2.4" />
      <circle cx="24" cy="32.5" r="2.15" fill="currentColor" stroke="none" />
    </svg>
  ),
  exam: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="13" y="8" width="22" height="32" rx="3" />
      <path d="M18 27l4.2 4.2L31 20" />
    </svg>
  ),
  simulation: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M11 39V23L24 13l13 10v16" />
      <path d="M20 39V29h8v10" />
    </svg>
  ),
  combination: (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="7" y="17" width="20" height="20" rx="3" />
      <path d="M18 17V13a3 3 0 0 1 3-3h15a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3h-4" />
    </svg>
  ),
}

export default function AssessmentTypePicker({ types, value, onChange }) {
  return (
    <div className="af-type-picker" role="radiogroup" aria-label="Assessment type">
      {types.map((type) => (
        <button
          key={type.value}
          type="button"
          role="radio"
          aria-checked={value === type.value}
          className={`af-type-picker__btn${value === type.value ? ' is-active' : ''}`}
          onClick={() => onChange(type.value)}
        >
          <span className="af-type-picker__symbol">{SYMBOLS[type.value]}</span>
          <span className="af-type-picker__label">{type.label}</span>
        </button>
      ))}
    </div>
  )
}
