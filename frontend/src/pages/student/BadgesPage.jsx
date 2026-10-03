import { useState } from 'react'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

export default function BadgesPage() {
  const [badges, setBadges] = useState([])

  const load = () => client.get('/badges').then((res) => setBadges(res.data.badges))
  useAutoRefresh(load, [])

  return (
    <div className="space-y-8">
      <PageHeader title="Badges" description="Earned achievements." />
      <div className="grid gap-4 md:grid-cols-2">
        {badges.map((b) => (
          <div key={b.id} className="card-gold-border p-4">
            <h3 className="font-bold text-[#491464]">{b.badge?.name}</h3>
            <p className="text-sm text-[#5c297c]">{b.badge?.description}</p>
            <p className="mt-2 text-xs text-[#5c297c]">{new Date(b.earned_at).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
