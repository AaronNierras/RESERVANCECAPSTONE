export default function PageHeader({ title, description }) {
  return (
    <header className="space-y-2">
      <h1 className="font-headline text-3xl font-bold text-[#491464]">{title}</h1>
      {description && <p className="max-w-3xl text-[#5c297c]">{description}</p>}
    </header>
  )
}
