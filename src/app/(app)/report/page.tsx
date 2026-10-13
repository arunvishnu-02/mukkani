import { requireUser } from '@/lib/auth'
import { addDays, day, dayInput, fmtWeekday } from '@/lib/dates'
import { reportsFor } from '@/lib/reports'
import { PageHeader, Tabs } from '@/components/ui'
import { KpiGrid, type KpiCard } from '@/components/KpiGrid'


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
  const cards: KpiCard[] = mine.map(([k, r], i) => ({ key: k, href: `/report/${k}${r.date && !r.allTime ? `?from=${dayInput(from)}&to=${dayInput(today)}` : ''}`, title: r.title, group: r.group, ...kpis[i] }))
  return (
    <>
      <PageHeader title="All reports" sub={`${periods[key][0]} · ${key === 'today' ? fmtWeekday(today) : `${fmtWeekday(from)} to ${fmtWeekday(today)}`}. Tap a card to open the full report with filters, sorting and download.`}>
        <Tabs items={Object.entries(periods).map(([k, [label]]) => ({ label, href: `/report?period=${k}`, active: k === key }))} />
      </PageHeader>
      <KpiGrid cards={cards} />
    </>
  )
}
