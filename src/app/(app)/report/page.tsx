import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { reportsFor } from '@/lib/reports'
import { PageHeader } from '@/components/ui'

// All reports: every part of the app as a table that can be filtered, sorted and downloaded.
export default async function ReportsHub() {
  const user = await requireUser()
  const mine = reportsFor(user.role)
  const groups = ['Sales', 'Kitchen', 'Business'].map((g) => [g, mine.filter(([, r]) => r.group === g)] as const).filter(([, list]) => list.length > 0)
  return (
    <>
      <PageHeader title="All reports" sub="Pick a report, set the dates and filters, tap a column heading to sort, and download it for Excel." />
      {groups.map(([g, list]) => (
        <section key={g}>
          <h2 className="mb-2 text-[11px] font-semibold tracking-widest text-muted uppercase">{g}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map(([key, r]) => (
              <Link key={key} href={`/report/${key}`} className="card block px-5 py-4 hover:border-brand">
                <div className="font-display text-lg font-semibold">{r.title}</div>
                <p className="mt-0.5 text-[13px] text-muted">{r.about}</p>
                <span className="mt-2 inline-block text-[13px] font-semibold text-brand">Open report ›</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
