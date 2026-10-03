import { Outlet } from 'react-router-dom'
import './login.css'

export default function AuthShell() {
  return (
    <div className="login-scene">
      <div className="login-scene__bg" aria-hidden="true" />
      <div className="login-scene__overlay" aria-hidden="true" />
      <div className="login-scene__shimmer" aria-hidden="true" />
      <div className="login-scene__glow login-scene__glow--gold" aria-hidden="true" />
      <div className="login-scene__glow login-scene__glow--purple" aria-hidden="true" />
      <div className="relative z-10 flex min-h-screen min-h-dvh items-center justify-center p-4 sm:p-6">
        <Outlet />
      </div>
    </div>
  )
}
