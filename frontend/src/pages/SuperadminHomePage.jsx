import PageHeader from '../components/PageHeader'
import { useAuth } from '../context/AuthContext'
import '../styles/dashboard.css'

export default function SuperadminHomePage() {
  const { user } = useAuth()
  const name = user?.name || 'Superadmin'

  return (
    <div className="dash-page">
      <PageHeader
        title={`Welcome, ${name}`}
        description="This is the Superadmin home. Program Chair tools stay on the Program Chair account."
      />
    </div>
  )
}
