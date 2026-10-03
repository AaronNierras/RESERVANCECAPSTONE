import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoadingScreen from '../components/LoadingScreen'
import '../layouts/login.css'

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18M10.5 10.67A2 2 0 0 0 12 14a2 2 0 0 0 1.85-1.25M9.88 5.1A10.94 10.94 0 0 1 12 5c7 0 10 7 10 7a18.45 18.45 0 0 1-4.06 5.12M6.12 6.12A18.45 18.45 0 0 0 2 12s3 7 10 7a10.94 10.94 0 0 0 2.12-.26"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idleNotice = searchParams.get('reason') === 'idle'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      if (user.role === 'super_admin') navigate('/superadmin/dashboard')
      else if (user.role === 'faculty') navigate('/faculty/students')
      else navigate('/student')
    } catch (err) {
      const apiEmailError = err.response?.data?.errors?.email?.[0]
      setError(apiEmailError || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const clearError = () => {
    if (error) setError('')
  }

  return (
    <>
      {loading && <LoadingScreen message="Signing you in…" />}
      <div className="login-card-shell">
      <div className="login-card">
        <div className="login-card__frame" aria-hidden="true">
          <span className="login-card__edge login-card__edge--left" />
          <span className="login-card__edge login-card__edge--right" />
          <span className="login-card__corner login-card__corner--tl" />
          <span className="login-card__corner login-card__corner--tr" />
          <span className="login-card__corner login-card__corner--bl" />
          <span className="login-card__corner login-card__corner--br" />
        </div>

        <div className="login-card__content">
          <header className="login-brand">
            <img
              src="/logosymbol.png"
              alt=""
              className="login-brand__symbol"
              width={80}
              height={80}
            />
            <img
              src="/logotext.png"
              alt="RESERVANCE"
              className="login-brand__text"
            />
            <h1 className="login-welcome__title">Welcome Back</h1>
            <p className="login-welcome__subtitle">to your learning space</p>
          </header>

          <div className="login-divider" aria-hidden="true" />

          <p className="login-form-intro">Enter your account details below</p>

          {idleNotice && (
            <p className="login-idle-notice" role="status">
              Your session ended after 10 minutes of inactivity. Please sign in again.
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#491464]" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  clearError()
                }}
                className={`login-field${error ? ' login-field--invalid' : ''}`}
                placeholder="you@school.edu"
                required
                aria-invalid={error ? 'true' : undefined}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#491464]" htmlFor="password">
                Password
              </label>
              <div className="login-field-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    clearError()
                  }}
                  className={`login-field${error ? ' login-field--invalid' : ''}`}
                  placeholder="Enter your password"
                  required
                  aria-invalid={error ? 'true' : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                />
                <button
                  type="button"
                  className="login-toggle-pw"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {error && (
                <p id="login-error" className="login-field-error" role="alert" aria-live="polite">
                  {error}
                </p>
              )}
            </div>

            <button type="submit" disabled={loading} className="login-submit">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="login-footer__sig">
            RESERVANCE <span aria-hidden="true">•</span> 2026
          </p>
        </div>
      </div>
    </div>
    </>
  )
}
