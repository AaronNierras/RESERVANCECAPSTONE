import { optimizeQuestionImage } from '../../utils/questionImage'
import {
  LAB_SCENARIOS,
  MAX_SCENARIOS,
  SCENARIO_ACTIONS,
  blankScenario,
  normalizeScenarioRows,
  scenarioCatalog,
} from '../../utils/labScenarios.js'

export { defaultScenarioScoring } from '../../utils/labScenarios.js'

export default function ScenarioNumberSheet({ scoring, onChange, onUploadImage, uploading }) {
  const sheet = scoring || { tries: 3, deduction: 2, manual_computation: true, scenarios: [] }
  const rows = normalizeScenarioRows(sheet.scenarios)
  const points = rows.reduce((sum, row) => sum + scenarioCatalog(row.task).points, 0)

  const write = (nextRows, patch = {}) => {
    onChange({
      tries: 3,
      deduction: Number(sheet.deduction ?? 2),
      manual_computation: true,
      ...patch,
      scenarios: nextRows.map((row) => ({
        id: row.id,
        title: row.title || '',
        instruction: row.instruction || '',
        image_url: row.image_url || '',
        image_path: row.image_path || '',
        task: row.task,
        action: row.action,
      })),
    })
  }

  const updateRow = (id, patch) => {
    write(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const moveRow = (index, direction) => {
    const next = [...rows]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    write(next)
  }

  const upload = async (id, event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !onUploadImage) return
    const optimized = await optimizeQuestionImage(file)
    const result = await onUploadImage(optimized, file.size)
    if (result) updateRow(id, { image_path: result.path, image_url: result.url })
  }

  return (
    <section className="sim-score-sheet">
      <header className="sim-score-sheet__head">
        <div>
          <h3>Scenarios you assign</h3>
          <p>
            {rows.length} scenario{rows.length === 1 ? '' : 's'} · {points} points.
            Add a card for each situation. The title and instruction are what the student must follow.
          </p>
        </div>
        <label className="af-field sim-score-sheet__deduction">
          <span>Deduction per wrong try</span>
          <input
            className="af-input"
            type="number"
            min={0}
            max={20}
            value={sheet.deduction ?? 2}
            onChange={(event) => write(rows, { deduction: Number(event.target.value) })}
          />
        </label>
      </header>
      <p className="sim-score-sheet__note">
        Choose what the student does on each card. Booking, check-in, and check-out are checked against the answer key, with 3 tries. Any other situation uses Follow this instruction, and you score that output yourself. The point range still comes from the laboratory sheet.
      </p>
      <ol className="sim-score-sheet__list">
        {rows.map((row, index) => {
          const catalog = scenarioCatalog(row.task)
          return (
            <li key={row.id}>
              <div className="sim-score-sheet__toolbar">
                <strong>Scenario {index + 1}</strong>
                <span>{catalog.points} points · {catalog.range}</span>
                <div className="sim-score-sheet__toolbar-actions">
                  <button type="button" className="af-btn af-btn--ghost" disabled={index === 0} onClick={() => moveRow(index, -1)}>Up</button>
                  <button type="button" className="af-btn af-btn--ghost" disabled={index === rows.length - 1} onClick={() => moveRow(index, 1)}>Down</button>
                  <button type="button" className="af-btn af-btn--ghost" onClick={() => write(rows.filter((item) => item.id !== row.id))}>Remove</button>
                </div>
              </div>
              <div className="sim-score-sheet__body">
                <label className="af-field">
                  <span>Scenario title</span>
                  <input
                    className="af-input"
                    value={row.title}
                    maxLength={120}
                    placeholder={catalog.title}
                    onChange={(event) => updateRow(row.id, { title: event.target.value })}
                  />
                </label>
                <div className="af-form-grid af-form-grid--2">
                  <label className="af-field">
                    <span>What the student must do</span>
                    <select
                      className="af-select"
                      value={row.action}
                      onChange={(event) => updateRow(row.id, { action: event.target.value })}
                    >
                      {SCENARIO_ACTIONS.map((action) => (
                        <option key={action.value} value={action.value}>{action.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="af-field">
                    <span>Point range</span>
                    <select
                      className="af-select"
                      value={row.task}
                      onChange={(event) => updateRow(row.id, { task: event.target.value })}
                    >
                      {LAB_SCENARIOS.map((item) => (
                        <option key={item.key} value={item.key}>{item.title} · {item.points} pts ({item.range})</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="af-field">
                  <span>Instruction for this scenario</span>
                  <textarea
                    className="af-textarea"
                    rows={3}
                    value={row.instruction}
                    onChange={(event) => updateRow(row.id, { instruction: event.target.value })}
                  />
                </label>
                <div className="sim-score-sheet__image">
                  {row.image_url && <img src={row.image_url} alt="" />}
                  <label className="af-btn af-btn--ghost">
                    {uploading ? 'Uploading…' : row.image_url ? 'Replace image' : 'Add image'}
                    <input type="file" accept="image/*" hidden disabled={uploading} onChange={(event) => upload(row.id, event)} />
                  </label>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      <button
        type="button"
        className="af-btn af-btn--gold sim-score-sheet__add"
        disabled={rows.length >= MAX_SCENARIOS}
        onClick={() => write([...rows, blankScenario()])}
      >
        Add scenario
      </button>
    </section>
  )
}
