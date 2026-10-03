import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { formatSectionLabel } from '../../utils/academic'
import '../../styles/academic.css'

export default function StudentHomePage() {
  const { user } = useAuth()
  const [academic, setAcademic] = useState(null)

  useEffect(() => {
    client.get('/student/academic').then((res) => setAcademic(res.data.academic)).catch(() => {})
  }, [])

  const profile = academic || user?.student_profile
  const period = profile?.current_period

  return (
    <div className="space-y-8">
      <PageHeader title="Welcome" description="View activities, scores, and progress." />

      {profile && (
        <section className="student-academic-card" aria-label="Academic information">
          <p className="student-academic-card__program">
            {profile.section?.display_label
              || formatSectionLabel(profile.program?.name, profile.year_level, profile.section?.name, profile.section?.semester)}
          </p>
          <p className="student-academic-card__meta">
            {profile.year_level_label || 'Year level'}
          </p>
          <p className="student-academic-card__year">{period?.school_year || 'School year'}</p>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Link to="/student/activities" className="card-gold-border block p-6 hover:shadow-md">
          <h3 className="font-bold text-[#491464]">Activities</h3>
          <p className="text-sm text-[#5c297c]">Take assigned quizzes and exams.</p>
        </Link>
        <Link to="/student/scores" className="card-gold-border block p-6 hover:shadow-md">
          <h3 className="font-bold text-[#491464]">Scores</h3>
          <p className="text-sm text-[#5c297c]">Review results and breakdown.</p>
        </Link>
      </div>
    </div>
  )
}
