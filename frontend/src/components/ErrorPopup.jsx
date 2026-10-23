import { useEffect, useState } from 'react'

export default function ErrorPopup() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    const onError = (event) => setMessage(event.detail?.message || 'Something went wrong. It has been sent for maintenance.')
    window.addEventListener('reservance-error', onError)
    return () => window.removeEventListener('reservance-error', onError)
  }, [])

  if (!message) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#2e0046]/45 p-4" role="alertdialog" aria-modal="true" aria-labelledby="error-popup-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="error-popup-title" className="text-lg font-bold text-[#491464]">Something needs attention</h2>
        <p className="mt-2 text-sm text-[#5c297c]">{message}</p>
        <p className="mt-2 text-sm text-[#5c297c]">This was saved for Superadmin maintenance. You can keep using the rest of the system.</p>
        <button type="button" className="mt-4 rounded-lg bg-[#ffb736] px-4 py-2 font-bold text-[#491464]" onClick={() => setMessage('')}>
          Continue
        </button>
      </div>
    </div>
  )
}
