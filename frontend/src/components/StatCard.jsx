export default function StatCard({ label, value }) {
  return (
    <div className="card-gold-border p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#5c297c]">{label}</p>
      <p className="mt-2 font-headline text-3xl font-bold text-[#491464]">{value}</p>
    </div>
  )
}
