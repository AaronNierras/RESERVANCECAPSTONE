const SPARKLES = [
  { top: '7%', left: '8%', size: 8, delay: '0s', tone: 'white' },
  { top: '14%', left: '22%', size: 5, delay: '0.15s', tone: 'gold' },
  { top: '11%', left: '78%', size: 9, delay: '0.28s', tone: 'white' },
  { top: '6%', left: '88%', size: 6, delay: '0.08s', tone: 'gold' },
  { top: '22%', left: '6%', size: 5, delay: '0.42s', tone: 'gold' },
  { top: '28%', left: '16%', size: 10, delay: '0.05s', tone: 'white' },
  { top: '18%', left: '92%', size: 7, delay: '0.36s', tone: 'white' },
  { top: '34%', left: '84%', size: 5, delay: '0.55s', tone: 'gold' },
  { top: '46%', left: '4%', size: 8, delay: '0.2s', tone: 'gold' },
  { top: '58%', left: '12%', size: 6, delay: '0.48s', tone: 'white' },
  { top: '42%', left: '94%', size: 9, delay: '0.12s', tone: 'white' },
  { top: '64%', left: '90%', size: 5, delay: '0.62s', tone: 'gold' },
  { top: '72%', left: '7%', size: 7, delay: '0.3s', tone: 'white' },
  { top: '78%', left: '18%', size: 5, delay: '0.7s', tone: 'gold' },
  { top: '70%', left: '82%', size: 10, delay: '0.18s', tone: 'gold' },
  { top: '84%', left: '74%', size: 6, delay: '0.5s', tone: 'white' },
  { top: '88%', left: '10%', size: 8, delay: '0.22s', tone: 'gold' },
  { top: '91%', left: '46%', size: 5, delay: '0.4s', tone: 'white' },
  { top: '16%', left: '48%', size: 6, delay: '0.33s', tone: 'gold' },
  { top: '86%', left: '58%', size: 7, delay: '0.58s', tone: 'white' },
  { top: '38%', left: '24%', size: 4, delay: '0.66s', tone: 'white' },
  { top: '52%', left: '76%', size: 4, delay: '0.44s', tone: 'gold' },
]

export default function LoginGlitter() {
  return (
    <div className="login-scene__glitter" aria-hidden="true">
      {SPARKLES.map((sparkle) => (
        <span
          key={`${sparkle.top}-${sparkle.left}`}
          className={`login-sparkle login-sparkle--${sparkle.tone}`}
          style={{
            top: sparkle.top,
            left: sparkle.left,
            width: sparkle.size,
            height: sparkle.size,
            animationDelay: sparkle.delay,
          }}
        />
      ))}
    </div>
  )
}
