import { useState } from 'react'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([])

  const load = () => client.get('/templates').then((res) => setTemplates(res.data.templates))
  useAutoRefresh(load, [])

  return (
    <div className="space-y-8">
      <PageHeader title="Templates" description="Save an activity as a faculty-shared template. Faculty copy it into their own activity, then edit that copy." />
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((t) => (
          <div key={t.id} className="card-gold-border p-4">
            <h3 className="font-bold text-[#491464]">{t.title}</h3>
            <p className="text-sm text-[#5c297c]">{t.visibility}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
