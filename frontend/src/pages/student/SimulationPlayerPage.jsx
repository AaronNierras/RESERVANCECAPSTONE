import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client from '../../api/client'
import LoadingScreen from '../../components/LoadingScreen'
import CheckInPanel from '../../components/hotel/CheckInPanel'
import CheckOutPanel from '../../components/hotel/CheckOutPanel'
import HotelShell from '../../components/hotel/HotelShell'
import ReservationPanel from '../../components/hotel/ReservationPanel'
import RoomBoard from '../../components/hotel/RoomBoard'
import SimulationResult from '../../components/hotel/SimulationResult'
import '../../styles/hotel-simulation.css'

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function SimulationPlayerPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [meta, setMeta] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [hotel, setHotel] = useState(null)
  const [phase, setPhase] = useState('loading')
  const [activeTab, setActiveTab] = useState('reservations')
  const [score, setScore] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(null)
  const deadlineRef = useRef(null)
  const submitRef = useRef(null)

  useEffect(() => {
    client.get(`/student/activities/${id}`)
      .then((res) => {
        const existing = res.data.attempt
        if (existing && ['submitted', 'failed', 'missed'].includes(existing.status)) {
          navigate('/student/activities', { replace: true })
          return
        }
        setMeta(res.data)
        if (existing?.status === 'in_progress') {
          client.post(`/student/activities/${id}/start`).then((startRes) => {
            setAttempt(startRes.data.attempt)
            setHotel(startRes.data.hotel)
            if (startRes.data.attempt?.server_deadline_at) {
              deadlineRef.current = new Date(startRes.data.attempt.server_deadline_at).getTime()
            }
            setPhase('playing')
          })
        } else {
          setPhase('intro')
        }
      })
      .catch(() => navigate('/student/activities', { replace: true }))
  }, [id, navigate])

  const syncTimer = useCallback((attemptData, activity) => {
    if (attemptData?.server_deadline_at) {
      deadlineRef.current = new Date(attemptData.server_deadline_at).getTime()
    } else if (activity?.time_limit_minutes && attemptData?.started_at) {
      const start = new Date(attemptData.started_at).getTime()
      deadlineRef.current = start + activity.time_limit_minutes * 60 * 1000
    } else {
      deadlineRef.current = null
    }
  }, [])

  const handleSubmit = useCallback(async (auto = false) => {
    if (submitLoading || !attempt) return
    if (!auto && !window.confirm('Submit your simulation for grading?')) return
    setSubmitLoading(true)
    try {
      const res = await client.post(`/student/attempts/${attempt.id}/simulation/submit`)
      setScore(res.data.score)
      setPhase('result')
    } catch {
      if (!auto) window.alert('Could not submit simulation.')
    } finally {
      setSubmitLoading(false)
    }
  }, [attempt, submitLoading])

  submitRef.current = handleSubmit

  useEffect(() => {
    if (!deadlineRef.current || phase !== 'playing') return undefined
    const tick = () => {
      const left = Math.max(0, Math.floor((deadlineRef.current - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left <= 0) submitRef.current?.(true)
    }
    tick()
    const timerId = setInterval(tick, 1000)
    return () => clearInterval(timerId)
  }, [phase, attempt?.id])

  const beginSimulation = async () => {
    const res = await client.post(`/student/activities/${id}/start`)
    setAttempt(res.data.attempt)
    setHotel(res.data.hotel)
    syncTimer(res.data.attempt, meta?.activity)
    setPhase('playing')
  }

  const refreshHotel = (data) => setHotel(data.hotel || data)

  const handleBook = async (form) => {
    setActionLoading(true)
    try {
      const res = await client.post(`/student/attempts/${attempt.id}/simulation/book`, form)
      refreshHotel(res.data)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCheckIn = async (payload) => {
    setActionLoading(true)
    try {
      const res = await client.post(`/student/attempts/${attempt.id}/simulation/check-in`, payload)
      refreshHotel(res.data)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCheckOut = async (payload) => {
    setActionLoading(true)
    try {
      const res = await client.post(`/student/attempts/${attempt.id}/simulation/check-out`, payload)
      refreshHotel(res.data)
    } finally {
      setActionLoading(false)
    }
  }

  if (phase === 'loading' || !meta) {
    return <LoadingScreen message="Loading hotel simulation…" />
  }

  const activity = meta.activity

  if (phase === 'intro') {
    return (
      <div className="hotel-root">
        <div className="hotel-intro">
          <div className="hotel-intro__card">
            <img src="/logosymbol.png" alt="" className="hotel-intro__logo" />
            <h1 className="hotel-intro__title">{activity.hotel_name || 'RESERVANCE Grand Hotel'}</h1>
            <p className="hotel-intro__subtitle">{activity.title}</p>
            <div className="hotel-intro__briefing">
              <p className="font-bold mb-2">Front Desk Briefing</p>
              <p>{activity.briefing || activity.instructions || 'Complete the guest reservation workflow at the front desk.'}</p>
            </div>
            <button type="button" className="hotel-intro__btn" onClick={beginSimulation}>
              Enter Front Desk
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'result' && score) {
    return (
      <SimulationResult
        score={score}
        activityTitle={activity.title}
      />
    )
  }

  const panel = activeTab === 'reservations' ? (
    <ReservationPanel hotel={hotel} onBook={handleBook} loading={actionLoading} />
  ) : activeTab === 'checkin' ? (
    <CheckInPanel hotel={hotel} onCheckIn={handleCheckIn} loading={actionLoading} />
  ) : (
    <CheckOutPanel hotel={hotel} onCheckOut={handleCheckOut} loading={actionLoading} />
  )

  return (
    <div className="hotel-root">
      <HotelShell
        hotelName={hotel?.hotel_name || activity.hotel_name || 'RESERVANCE Grand Hotel'}
        activityTitle={activity.title}
        timerLabel={secondsLeft != null ? formatTimer(secondsLeft) : null}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sidebar={(
          <RoomBoard rooms={hotel?.rooms || []} roomTypes={hotel?.room_types || []} />
        )}
        panel={panel}
        footer={(
          <button
            type="button"
            className="hotel-btn hotel-btn--purple"
            onClick={() => handleSubmit(false)}
            disabled={submitLoading}
          >
            {submitLoading ? 'Submitting…' : 'Complete Simulation'}
          </button>
        )}
      />
    </div>
  )
}
