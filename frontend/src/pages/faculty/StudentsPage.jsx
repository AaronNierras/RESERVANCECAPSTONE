import { useState } from 'react'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

export default function FacultyStudentsPage() {
  const [students, setStudents] = useState([])

  const load = () => client.get('/faculty/students').then((res) => setStudents(res.data.students))
  useAutoRefresh(load, [])

  return (
    <div className="space-y-8">
      <PageHeader title="Students" description="View student profiles." />
      <div className="card-gold-border overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3edf7]"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Program</th><th className="p-3">Section</th></tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-t"><td className="p-3">{s.name}</td><td className="p-3">{s.email}</td><td className="p-3">{s.student_profile?.program?.name}</td><td className="p-3">{s.student_profile?.section?.name}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
