import { useState } from 'react'
import client from '../../api/client'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'

export default function TutorialPage() {
  const [tutorials, setTutorials] = useState([])

  const load = () => client.get('/tutorials').then((res) => setTutorials(res.data.tutorials))
  useAutoRefresh(load, [])

  return (
    <div className="space-y-8">
      <PageHeader title="Tutorial" description="User manual and FAQ." />
      <div className="space-y-4">
        {tutorials.map((t) => (
          <article key={t.id} className="card-gold-border p-5">
            <h3 className="font-bold text-[#491464]">{t.title}</h3>
            <p className="mt-2 text-[#5c297c]">{t.content}</p>
            {t.video_url && (
              <a href={t.video_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-[#ffb736]">Watch video</a>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
