export default function ScenarioCards({ scenarios = [], triesLeft = {} }) {
  if (!scenarios.length) return null

  return (
    <section className="hotel-scenarios" aria-label="Scenario instructions">
      {scenarios.map((item) => {
        const left = triesLeft[item.action || item.key]
        return (
          <article key={item.id || item.key} className="hotel-scenario-card">
            <header>
              <strong>Scenario {item.number}</strong>
              <span>{item.points} points · {item.range}</span>
            </header>
            <h3>{item.title}</h3>
            <p>{item.instruction}</p>
            {item.image_url && <img src={item.image_url} alt="" />}
            {item.playable && (
              <p className="hotel-scenario-card__tries">
                3 tries. {left == null ? `${item.deduction} points off each wrong try.` : `${left} left. ${item.deduction} points off each wrong try.`}
              </p>
            )}
          </article>
        )
      })}
    </section>
  )
}
