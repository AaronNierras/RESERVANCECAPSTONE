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
      <PageHeader title="Welcome" description="Your classes, activities, and progress." />

      <section className="student-academic-card" aria-label="Student profile">
        <p className="student-academic-card__program">{user?.name || 'Student'}</p>
        <p className="student-academic-card__meta">{user?.email}</p>
        {profile?.student_number && <p className="student-academic-card__meta">{profile.student_number}</p>}
        <p className="student-academic-card__meta">
          {profile?.program?.name || 'Course assigned after acceptance'}
        </p>
        <p className="student-academic-card__meta">
          {profile?.section?.display_label
            || (profile?.section?.name
              ? formatSectionLabel(profile.program?.code || profile.program?.name, profile.year_level, profile.section?.name, profile.section?.semester)
              : 'Section not assigned yet')}
        </p>
        <p className="student-academic-card__year">{profile?.year_level_label || 'Year level'} · {period?.school_year || 'School year'}</p>
      </section>

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
