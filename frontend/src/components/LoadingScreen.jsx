import '../styles/loading.css'

export default function LoadingScreen({ message, fullscreen = true, compact = false }) {
  return (
    <div
      className={`rv-loader ${fullscreen ? 'rv-loader--fullscreen' : ''} ${compact ? 'rv-loader--compact' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={message || 'Loading'}
    >
      <div className="rv-loader__brand">
        <img src="/logosymbol.png" alt="" className="rv-loader__symbol" width={compact ? 56 : 72} height={compact ? 56 : 72} />
        <img src="/logotext.png" alt="RESERVANCE" className="rv-loader__text" />
      </div>

      <div className="rv-loader__bars" aria-hidden="true">
        <span className="rv-loader__bar" />
        <span className="rv-loader__bar" />
        <span className="rv-loader__bar" />
      </div>

      {message && <p className="rv-loader__message">{message}</p>}
    </div>
  )
}
