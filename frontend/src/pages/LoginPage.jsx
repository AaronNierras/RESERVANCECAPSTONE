import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoadingScreen from '../components/LoadingScreen'
import Modal from '../components/Modal'
import { homePathFor } from '../components/StudentLoginLeaveGuard'
import { validateStudentRegistration } from '../utils/academic'
import '../layouts/login.css'
import '../styles/academic.css'

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
  const { login, register, user, logout, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idleNotice = searchParams.get('reason') === 'idle'
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [registerForm, setRegisterForm] = useState({
    first_name: '',
    last_name: '',
    student_number: '',
    email: '',
    password: '',
    password_confirmation: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [logoutPrompt, setLogoutPrompt] = useState(false)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const allowLoginView = useRef(false)

  const clearLoginFields = () => {
    setEmail('')
    setPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setRegisterForm({
      first_name: '',
      last_name: '',
      student_number: '',
      email: '',
      password: '',
      password_confirmation: '',
    })
    setFieldErrors({})
    setError('')
    setNotice('')
    setFormKey((value) => value + 1)
  }

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      allowLoginView.current = false
      setLogoutPrompt(false)
      clearLoginFields()
      return
    }
    // Student reached /login while still signed in (edited URL / history).
    if (user.role === 'student' && !allowLoginView.current) {
      setLogoutPrompt(true)
    } else if (user.role !== 'student') {
      navigate(homePathFor(user), { replace: true })
    }
  }, [user, authLoading, navigate])

  const staySignedIn = () => {
    setLogoutPrompt(false)
    navigate(homePathFor(user), { replace: true })
  }

  const confirmLogout = async () => {
    if (logoutBusy) return
    setLogoutBusy(true)
    try {
      allowLoginView.current = true
      await logout()
      clearLoginFields()
      setLogoutPrompt(false)
    } finally {
      setLogoutBusy(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      if (user.role === 'program_chair') navigate('/program-chair/dashboard')
      else if (user.role === 'super_admin') navigate('/superadmin')
      else if (user.role === 'faculty') navigate('/faculty/students')
      else navigate('/student')
    } catch (err) {
      const apiEmailError = err.response?.data?.errors?.email?.[0]
      if (apiEmailError) {
        setError(apiEmailError)
      } else if (!err.response) {
        setError('Cannot reach the API server. Keep RESERVANCE running and open the site at http://127.0.0.1:5173 (or the Students use URL on other PCs).')
      } else {
        setError('Invalid email or password.')
      }
    } finally {
      setLoading(false)
    }
  }

  const updateRegisterField = (field, value) => {
    setRegisterForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    if (error) setError('')
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    const validation = validateStudentRegistration(registerForm)
    setFieldErrors(validation)
    if (Object.keys(validation).length) return

    setError('')
    setLoading(true)
    try {
      const result = await register({
        first_name: registerForm.first_name,
        last_name: registerForm.last_name,
        student_number: registerForm.student_number,
        email: registerForm.email,
        password: registerForm.password,
        password_confirmation: registerForm.password_confirmation,
      })
      if (result?.token) {
        navigate('/student')
        return
      }
      clearLoginFields()
      setMode('login')
      setNotice(result?.message || 'Registration received. You can sign in after the Program Chair accepts your account.')
    } catch (err) {
      const apiErrors = err.response?.data?.errors
      if (apiErrors) {
        setFieldErrors(Object.fromEntries(
          Object.entries(apiErrors).map(([key, messages]) => [key, messages[0]]),
        ))
      } else if (!err.response) {
        setError('Cannot reach the API server. Keep RESERVANCE running and open the site at http://127.0.0.1:5173 (or the Students use URL on other PCs).')
      } else {
        setError('Unable to register right now.')
      }
    } finally {
      setLoading(false)
    }
  }

  const clearError = () => {
    if (error) setError('')
  }

  return (
    <>
      {loading && <LoadingScreen message={mode === 'register' ? 'Creating your account…' : 'Signing you in…'} />}
      <Modal
        open={logoutPrompt}
        title="Log out?"
        onClose={staySignedIn}
        footer={(
          <>
            <button
              type="button"
              className="rounded-lg border border-[#5c297c]/20 px-4 py-2 text-sm font-semibold text-[#491464]"
              onClick={staySignedIn}
              disabled={logoutBusy}
            >
              Stay signed in
            </button>
            <button
              type="button"
              className="rounded-lg bg-[#491464] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={confirmLogout}
              disabled={logoutBusy}
            >
              {logoutBusy ? 'Signing out…' : 'Log out'}
            </button>
          </>
        )}
      >
        <p className="text-sm leading-relaxed text-[#5c297c]">
          Are you sure you want to log out?
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[#5c297c]">
          You are trying to leave your student session and go to the login page.
        </p>
      </Modal>
      <div className={`login-card-shell${mode === 'register' ? ' login-card-shell--wide' : ''}`}>
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
            <h1 className="login-welcome__title">{mode === 'register' ? 'Create Account' : 'Welcome Back'}</h1>
            <p className="login-welcome__subtitle">
              {mode === 'register' ? 'student registration' : 'to your learning space'}
            </p>
          </header>

          <div className="login-divider" aria-hidden="true" />

          <p className="login-form-intro">
            {mode === 'register' ? 'Register with your MCU student details' : 'Enter your account details below'}
          </p>

          {mode === 'login' && idleNotice && (
            <p className="login-idle-notice" role="status">
              Your session ended after 10 minutes of inactivity. Please sign in again.
            </p>
          )}

          {mode === 'login' ? (
          <form key={formKey} onSubmit={handleSubmit} className="mt-5 space-y-4" autoComplete="off">
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
              {notice && (
                <p className="login-field-error" role="status" style={{ color: '#491464' }}>
                  {notice}
                </p>
              )}
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
          ) : (
          <form key={formKey} onSubmit={handleRegister} className="login-register-form" autoComplete="off">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#491464]" htmlFor="first-name">
                First Name
              </label>
              <input
                id="first-name"
                value={registerForm.first_name}
                onChange={(e) => updateRegisterField('first_name', e.target.value)}
                className={`login-field${fieldErrors.first_name ? ' login-field--invalid' : ''}`}
                autoComplete="given-name"
                required
              />
              {fieldErrors.first_name && <p className="login-field-error">{fieldErrors.first_name}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#491464]" htmlFor="last-name">
                Last Name
              </label>
              <input
                id="last-name"
                value={registerForm.last_name}
                onChange={(e) => updateRegisterField('last_name', e.target.value)}
                className={`login-field${fieldErrors.last_name ? ' login-field--invalid' : ''}`}
                autoComplete="family-name"
                required
              />
              {fieldErrors.last_name && <p className="login-field-error">{fieldErrors.last_name}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#491464]" htmlFor="student-number">
                Student Number
              </label>
              <input
                id="student-number"
                value={registerForm.student_number}
                onChange={(e) => updateRegisterField('student_number', e.target.value)}
                className={`login-field${fieldErrors.student_number ? ' login-field--invalid' : ''}`}
                autoComplete="off"
                required
              />
              <p className="login-field-hint">Letters and numbers only.</p>
              {fieldErrors.student_number && <p className="login-field-error">{fieldErrors.student_number}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#491464]" htmlFor="register-email">
                Email
              </label>
              <input
                id="register-email"
                type="email"
                value={registerForm.email}
                onChange={(e) => updateRegisterField('email', e.target.value)}
                className={`login-field${fieldErrors.email ? ' login-field--invalid' : ''}`}
                placeholder="name@student.mcu.edu.ph"
                autoComplete="email"
                required
              />
              <p className="login-field-hint">Must end with @student.mcu.edu.ph</p>
              {fieldErrors.email && <p className="login-field-error">{fieldErrors.email}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#491464]" htmlFor="register-password">
                Password
              </label>
              <div className="login-field-wrap">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  value={registerForm.password}
                  onChange={(e) => updateRegisterField('password', e.target.value)}
                  className={`login-field${fieldErrors.password ? ' login-field--invalid' : ''}`}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="login-toggle-pw"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              <p className="login-field-hint">8+ characters with upper, lower, number, and symbol.</p>
              {fieldErrors.password && <p className="login-field-error">{fieldErrors.password}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#491464]" htmlFor="confirm-password">
                Confirm Password
              </label>
              <div className="login-field-wrap">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={registerForm.password_confirmation}
                  onChange={(e) => updateRegisterField('password_confirmation', e.target.value)}
                  className={`login-field${fieldErrors.password_confirmation ? ' login-field--invalid' : ''}`}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="login-toggle-pw"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  aria-pressed={showConfirmPassword}
                >
                  <EyeIcon open={showConfirmPassword} />
                </button>
              </div>
              {fieldErrors.password_confirmation && (
                <p className="login-field-error">{fieldErrors.password_confirmation}</p>
              )}
            </div>

            {error && (
              <p className="login-field-error login-register-form__full" role="alert">
                {error}
              </p>
            )}

            <div className="login-register-form__full">
              <button type="submit" disabled={loading} className="login-submit">
                {loading ? 'Registering…' : 'Register'}
              </button>
            </div>
          </form>
          )}

          <p className="login-switch">
            {mode === 'register' ? 'Already have an account?' : 'New student?'}
            <button
              type="button"
              onClick={() => {
                clearLoginFields()
                setMode((current) => (current === 'register' ? 'login' : 'register'))
              }}
            >
              {mode === 'register' ? 'Sign in' : 'Register'}
            </button>
          </p>

          <p className="login-footer__sig">
            RESERVANCE <span aria-hidden="true">•</span> 2026
          </p>
        </div>
      </div>
    </div>
    </>
  )
}
