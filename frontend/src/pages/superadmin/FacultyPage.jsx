import { useMemo, useState } from 'react'
import client from '../../api/client'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { useConfirmCountdown } from '../../hooks/useConfirmCountdown'
import { capitalizeName, validateFacultyForm } from '../../utils/academic'
import '../../styles/academic.css'

const emptyForm = () => ({
  first_name: '',
  last_name: '',
  email: '',
  password: '',
})

function Field({ label, error, hint, children }) {
  return (
    <div className="form-field">
      <label>{label}</label>
      {children}
      {hint && <p className="form-field__hint">{hint}</p>}
      {error && <p className="form-field__error">{error}</p>}
    </div>
  )
}

export default function SuperAdminFacultyPage() {
  const [faculty, setFaculty] = useState([])
  const [form, setForm] = useState(emptyForm())
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [sort, setSort] = useState('name')

  const facultyConfirm = useConfirmCountdown(confirmModalOpen)
  const sortedFaculty = useMemo(() => [...faculty].sort((a, b) => {
    if (sort === 'email') return a.email.localeCompare(b.email)
    if (sort === 'status') return String(a.status).localeCompare(String(b.status)) || a.name.localeCompare(b.name)
    return a.name.localeCompare(b.name)
  }), [faculty, sort])

  const load = () => client.get('/super-admin/faculty').then((res) => setFaculty(res.data.faculty))
  useAutoRefresh(load, [])

  const updateField = (field, value) => {
    const nextValue = ['first_name', 'last_name'].includes(field) ? capitalizeName(value) : value
    setForm((prev) => ({ ...prev, [field]: nextValue }))
    setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }))
  }

  const openConfirm = (e) => {
    e.preventDefault()
    const validation = validateFacultyForm(form)
    setErrors(validation)
    if (Object.keys(validation).length) return
    setSubmitError('')
    setConfirmModalOpen(true)
  }

  const confirmAddFaculty = async () => {
    if (!facultyConfirm.ready) return

    setSubmitting(true)
    setSubmitError('')
    try {
      await client.post('/super-admin/faculty', {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
      })
      setForm(emptyForm())
      setErrors({})
      setConfirmModalOpen(false)
      load()
    } catch (err) {
      const apiErrors = err.response?.data?.errors
      if (apiErrors) {
        const mapped = Object.fromEntries(
          Object.entries(apiErrors).map(([key, messages]) => [key, messages[0]]),
        )
        setErrors(mapped)
      } else {
        setSubmitError(err.response?.data?.message || 'Unable to register faculty.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const previewName = `${form.first_name} ${form.last_name}`.trim()

  return (
    <div className="space-y-8">
      <PageHeader title="Faculty Registry" description="Register faculty accounts." />

      <form onSubmit={openConfirm} className="card-gold-border grid gap-4 p-6 md:grid-cols-2">
        <h3 className="form-section-title">Faculty Information</h3>

        <Field label="First Name" error={errors.first_name}>
          <input value={form.first_name} onChange={(e) => updateField('first_name', e.target.value)} required />
        </Field>

        <Field label="Last Name" error={errors.last_name}>
          <input value={form.last_name} onChange={(e) => updateField('last_name', e.target.value)} required />
        </Field>

        <Field label="Email" error={errors.email} hint="Must be a valid email with @ and a domain.">
          <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="name@example.com" required />
        </Field>

        <Field label="Password" error={errors.password} hint="8+ chars with upper, lower, number, and symbol.">
          <input type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} required />
        </Field>

        {submitError && <p className="form-field__error md:col-span-2">{submitError}</p>}

        <button type="submit" className="rounded-lg bg-[#ffb736] px-4 py-2 font-bold text-[#491464] md:col-span-2">
          Add faculty
        </button>
      </form>

      <div className="card-gold-border overflow-x-auto">
        <div className="flex justify-end p-3">
          <label className="text-sm font-semibold text-[#491464]" htmlFor="faculty-sort">
            Sort
            <select id="faculty-sort" className="ml-2 rounded-lg border px-3 py-2" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="status">Status</option>
            </select>
          </label>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f3edf7] text-[#491464]">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedFaculty.map((member) => (
              <tr key={member.id} className="border-t border-[#5c297c]/10">
                <td className="p-3">{member.name}</td>
                <td className="p-3">{member.email}</td>
                <td className="p-3 capitalize">{member.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={confirmModalOpen}
        title="Confirm Add Faculty"
        onClose={() => !submitting && setConfirmModalOpen(false)}
        footer={(
          <>
            <button type="button" className="rounded-lg border border-[#5c297c]/20 px-4 py-2 text-sm font-semibold text-[#491464]" onClick={() => setConfirmModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-[#ffb736] px-4 py-2 text-sm font-bold text-[#491464] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={confirmAddFaculty}
              disabled={submitting || !facultyConfirm.ready}
            >
              {submitting ? 'Adding…' : facultyConfirm.ready ? 'Confirm Add Faculty' : `Confirm (${facultyConfirm.countdown}s)`}
            </button>
          </>
        )}
      >
        <p className="text-sm text-[#5c297c]">Review the faculty account below before confirming.</p>
        <div className="mt-4 rounded-lg border border-[#5c297c]/12 bg-[#f8f5fc] p-4 text-sm">
          <p className="font-semibold text-[#491464]">Changes</p>
          <ul className="mt-2 space-y-2 text-[#5c297c]">
            <li>
              <span className="font-semibold text-[#491464]">Name</span>
              <br />
              {previewName || '—'}
            </li>
            <li>
              <span className="font-semibold text-[#491464]">Email</span>
              <br />
              {form.email || '—'}
            </li>
            <li>
              <span className="font-semibold text-[#491464]">Role</span>
              <br />
              Faculty account with active status
            </li>
          </ul>
        </div>
        {!facultyConfirm.ready && (
          <p className="form-field__hint mt-3">Confirm unlocks in {facultyConfirm.countdown} second{facultyConfirm.countdown === 1 ? '' : 's'}.</p>
        )}
        {submitError && <p className="form-field__error mt-3">{submitError}</p>}
      </Modal>
    </div>
  )
}
