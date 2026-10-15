import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import LoginBackdrop from './LoginBackdrop'
import LoginGlitter from './LoginGlitter'
import './login.css'

const WASH_MS = 2000

export default function AuthShell() {
  const [changing, setChanging] = useState(false)
  const washTimer = useRef(0)

  useEffect(() => () => window.clearTimeout(washTimer.current), [])

  function handleSlideChange() {
    setChanging(false)
    window.requestAnimationFrame(() => {
      setChanging(true)
      window.clearTimeout(washTimer.current)
      washTimer.current = window.setTimeout(() => setChanging(false), WASH_MS)
    })
  }

  return (
    <div className={`login-scene${changing ? ' is-changing' : ''}`}>
      <LoginBackdrop onSlideChange={handleSlideChange} />
      <div className="login-scene__overlay" aria-hidden="true" />
      <div className="login-scene__shimmer" aria-hidden="true" />
      <div className="login-scene__glow login-scene__glow--gold" aria-hidden="true" />
      <div className="login-scene__glow login-scene__glow--purple" aria-hidden="true" />
      <div className="login-scene__wash" aria-hidden="true" />
      <LoginGlitter />
      <div className="login-scene__stage">
        <Outlet />
      </div>
    </div>
  )
}
