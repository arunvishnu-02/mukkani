import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { addDays, day, dayInput, fmtWeekday } from '@/lib/dates'
import { reportsFor } from '@/lib/reports'
import { PageHeader, Tabs } from '@/components/ui'

const TEXT = { sky: 'text-sky', warn: 'text-warn', leaf: 'text-leaf', muted: 'text-muted', red: 'text-red', brand: 'text-brand' }
const EDGE = { sky: 'border-t-sky', warn: 'border-t-tur', leaf: 'border-t-leaf', muted: 'border-t-muted', red: 'border-t-red', brand: 'border-t-brand' }

// All reports as a dashboard: one card per report with its headline figure for the period. A card opens the full report.
export default async function ReportsHub({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser()
  const sp = await searchParams
  const today = day(0)
  const periods = {
    today: ['Today', today] as const,
    week: ['This week', addDays(today, -((today.getUTCDay() + 6) % 7))] as const,
    month: ['This month', new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))] as const,
  }
  const key = sp.period === 'today' || sp.period === 'week' ? sp.period : 'month'
  const from = periods[key][1]
  const mine = reportsFor(user.role)
  const kpis = await Promise.all(mine.map(([, r]) => r.kpi({ from, to: addDays(today, 1) })))
  const cards = mine.map(([k, r], i) => ({ key: k, report: r, kpi: kpis[i] }))
  const groups = ['Sales', 'Kitchen', 'Business'].map((g) => [g, cards.filter((c) => c.report.group === g)] as const).filter(([, list]) => list.length > 0)
  return (
    <>
      <PageHeader title="All reports" sub={`${periods[key][0]} · ${key === 'today' ? fmtWeekday(today) : `${fmtWeekday(from)} to ${fmtWeekday(today)}`}. Tap a card to open the full report with filters, sorting and download.`}>
        <Tabs items={Object.entries(periods).map(([k, [label]]) => ({ label, href: `/report?period=${k}`, active: k === key }))} />
      </PageHeader>
      {groups.map(([g, list]) => (
        <section key={g}>
          <h2 className="mb-2 text-[11px] font-semibold tracking-widest text-muted uppercase">{g}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map(({ key: k, report, kpi }) => (
              <Link key={k} href={`/report/${k}${report.date && !report.allTime ? `?from=${dayInput(from)}&to=${dayInput(today)}` : ''}`} className={`card group flex flex-col border-t-4 px-5 py-4 hover:shadow-md ${EDGE[kpi.tone]}`}>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-[13px] font-semibold text-muted">{report.title}</span>
                  <span className="text-[13px] font-semibold text-brand opacity-0 group-hover:opacity-100">Open ›</span>
                </div>
                <div className={`mt-1.5 font-display text-[34px] font-bold leading-none ${TEXT[kpi.tone]}`}>{kpi.value}</div>
                <div className="mt-1 text-sm font-semibold">{kpi.label}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted">{kpi.sub}</div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
