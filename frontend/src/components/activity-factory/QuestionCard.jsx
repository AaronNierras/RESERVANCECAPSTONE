import {
  addChoice,
  removeChoice,
  withQuestionType,
} from '../../utils/activityFactory'
import { optimizeQuestionImage } from '../../utils/questionImage'

export default function QuestionCard({
  question,
  index,
  errors = [],
  onChange,
  onUploadImage,
  uploading,
  uploadNote,
}) {
  const meta = question.metadata || {}
  const update = (patch) => onChange(index, { ...question, ...patch })
  const updateMeta = (patch) => update({ metadata: { ...meta, ...patch } })

  const toggleCorrect = (choiceIndex) => {
    const choices = [...question.choices]
    if (meta.allow_multiple_correct) {
      choices[choiceIndex] = {
        ...choices[choiceIndex],
        is_correct: !choices[choiceIndex].is_correct,
      }
    } else {
      update({
        choices: choices.map((c, i) => ({ ...c, is_correct: i === choiceIndex })),
      })
      return
    }
    update({ choices })
  }

  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !onUploadImage) return
    const optimized = await optimizeQuestionImage(file)
    const result = await onUploadImage(optimized, file.size)
    if (result) {
      updateMeta({ image_path: result.path, image_url: result.url })
    }
    e.target.value = ''
  }

  return (
    <article className={`af-question ${errors.length ? 'is-invalid' : ''}`}>
      <div className="af-question__head">
        <span className="af-question__num">Question {index + 1}</span>
        <div className="af-qtype" role="group" aria-label={`Question ${index + 1} answer type`}>
          <button
            type="button"
            className={question.type === 'mcq' ? 'is-active' : ''}
            onClick={() => onChange(index, withQuestionType(question, 'mcq'))}
          >
            Multiple choice
          </button>
          <button
            type="button"
            className={question.type === 'identification' ? 'is-active' : ''}
            onClick={() => onChange(index, withQuestionType(question, 'identification'))}
          >
            Identification
          </button>
        </div>
      </div>

      <div className="af-field">
        <label htmlFor={`q-body-${index}`}>Question text</label>
        <textarea
          id={`q-body-${index}`}
          className="af-textarea"
          rows={3}
          value={question.body ?? ''}
          onChange={(e) => update({ body: e.target.value })}
          placeholder="Enter your question"
        />
      </div>

      {question.type === 'mcq' && (
        <div className="af-question__section">
          <p className="af-question__section-label">Answer choices</p>
          <div className="af-choice-list">
            {(question.choices || []).map((choice, ci) => (
              <div key={choice.label} className="af-choice-row">
                <span className="af-choice-label">{choice.label}</span>
                <input
                  className="af-input"
                  value={choice.text ?? ''}
                  onChange={(e) => {
                    const choices = [...question.choices]
                    choices[ci] = { ...choice, text: e.target.value }
                    update({ choices })
                  }}
                  placeholder={`Choice ${choice.label}`}
                />
                <label className="af-toggle">
                  <input
                    type={meta.allow_multiple_correct ? 'checkbox' : 'radio'}
                    name={`correct-${index}`}
                    checked={Boolean(choice.is_correct)}
                    onChange={() => toggleCorrect(ci)}
                  />
                  Correct
                </label>
              </div>
            ))}
          </div>

          <div className="af-card__actions">
            <button
              type="button"
              className="af-btn af-btn--ghost"
              disabled={(question.choices || []).length >= 26}
              onClick={() => update({ choices: addChoice(question.choices || []) })}
            >
              Add choice
            </button>
            <button
              type="button"
              className="af-btn af-btn--ghost"
              disabled={(question.choices || []).length <= 2}
              onClick={() => update({ choices: removeChoice(question.choices || [], (question.choices || []).length - 1) })}
            >
              Remove last choice
            </button>
          </div>
        </div>
      )}

      {question.type === 'identification' && (
        <div className="af-question__section">
          <div className="af-field">
            <label htmlFor={`q-id-${index}`}>Primary accepted answer</label>
            <input
              id={`q-id-${index}`}
              className="af-input"
              value={meta.correct_answer || ''}
              onChange={(e) => updateMeta({ correct_answer: e.target.value })}
              placeholder="e.g. Logic"
            />
          </div>
          <p className="af-section-sub af-section-sub--compact">Additional accepted answers (case-insensitive)</p>
          <div className="af-choice-list">
            {(meta.alternatives || ['']).map((alt, ai) => (
              <div key={ai} className="af-choice-row af-choice-row--wide">
                <input
                  className="af-input"
                  value={alt}
                  onChange={(e) => {
                    const alternatives = [...(meta.alternatives || [''])]
                    alternatives[ai] = e.target.value
                    updateMeta({ alternatives })
                  }}
                  placeholder="Alternative answer"
                />
                <button
                  type="button"
                  className="af-btn af-btn--ghost"
                  disabled={(meta.alternatives || []).length <= 1}
                  onClick={() => updateMeta({ alternatives: (meta.alternatives || []).filter((_, i) => i !== ai) })}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="af-btn af-btn--ghost"
            onClick={() => updateMeta({ alternatives: [...(meta.alternatives || []), ''] })}
          >
            Add alternative
          </button>
        </div>
      )}

      <details className="af-question__more">
        <summary>Timer, image, and checking</summary>
        <div className="af-form-grid af-form-grid--2">
          <div className="af-field">
            <label htmlFor={`q-timer-${index}`}>Time limit (min 5 sec)</label>
            <input
              id={`q-timer-${index}`}
              className="af-input"
              type="number"
              min="5"
              placeholder="Optional"
              value={question.timer_seconds ?? ''}
              onChange={(e) => update({ timer_seconds: e.target.value })}
            />
          </div>
          <div className="af-field">
            <label>Question image</label>
            <p className="af-section-sub af-section-sub--compact">
              JPEG, PNG, or WebP up to 10MB. Auto-resized to WebP for faster loading.
            </p>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImage} disabled={uploading} />
            {uploading && <span className="af-save-state is-saving">Optimizing and uploading...</span>}
            {uploadNote && !uploading && <span className="af-save-state">{uploadNote}</span>}
            {meta.image_url && (
              <div className="af-image-preview">
                <img src={meta.image_url} alt={`Question ${index + 1}`} />
                <button type="button" className="af-btn af-btn--ghost" style={{ width: '100%', borderRadius: 0 }} onClick={() => updateMeta({ image_path: '', image_url: '' })}>
                  Remove image
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="af-question__options">
          <label className="af-toggle">
            <input
              type="checkbox"
              checked={Boolean(meta.manual_checking)}
              onChange={(e) => updateMeta({ manual_checking: e.target.checked })}
            />
            Require manual checking
          </label>
          {question.type === 'mcq' && (
            <label className="af-toggle">
              <input
                type="checkbox"
                checked={Boolean(meta.allow_multiple_correct)}
                onChange={(e) => updateMeta({ allow_multiple_correct: e.target.checked })}
              />
              Allow multiple correct answers
            </label>
          )}
        </div>
      </details>

      {errors.length > 0 && (
        <ul className="af-error" style={{ margin: '1rem 0 0', paddingLeft: '1.1rem' }}>
          {errors.map((err) => <li key={err}>{err}</li>)}
        </ul>
      )}
    </article>
  )
}
