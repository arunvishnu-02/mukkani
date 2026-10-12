import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { HOME, requireUser } from '@/lib/auth'
import { addDays, day, dayInput, fmtWeekday, isDay, parseDay } from '@/lib/dates'
import { regionsList } from '@/lib/queries'
import { REPORTS } from '@/lib/reports'
import { PageHeader } from '@/components/ui'
import { DateField } from '@/components/DateField'
import { ReportTable } from '@/components/ReportTable'

// One report: filters on top (dates, status, region), then the sortable table.
export default async function ReportPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser()
  const { kind } = await params
  const report = REPORTS[kind]
  if (!report) notFound()
  if (user.role !== 'ADMIN' && !report.roles.includes(user.role)) redirect(HOME[user.role])
  const sp = await searchParams
  const today = day(0)
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  const lastMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
  const weekStart = addDays(today, -((today.getUTCDay() + 6) % 7))
  // No dates in the address: this month, or everything for reports that are short lists.
  const untouched = sp.from === undefined && sp.to === undefined
  const from = !report.date ? null : untouched ? (report.allTime ? null : monthStart) : isDay(sp.from) ? parseDay(sp.from) : null
  const to = !report.date ? null : untouched ? (report.allTime ? null : today) : isDay(sp.to) ? parseDay(sp.to) : null
  const status = report.status?.some(([v]) => v === sp.status) ? sp.status! : null
  const regions = report.region ? await regionsList() : []
  const regionId = regions.find((r) => r.id === sp.region)?.id ?? null
  const rows = await report.load({ from, to: to ? addDays(to, 1) : null, status, regionId })
  const keep = `${status ? `&status=${status}` : ''}${regionId ? `&region=${regionId}` : ''}`
  const preset = (label: string, a: Date | null, b: Date | null) => {
    const on = (from?.getTime() ?? 0) === (a?.getTime() ?? 0) && (to?.getTime() ?? 0) === (b?.getTime() ?? 0)
    return <Link key={label} href={`/report/${kind}?from=${a ? dayInput(a) : ''}&to=${b ? dayInput(b) : ''}${keep}`} className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${on ? 'border-brand bg-brand text-white' : 'border-line bg-surface hover:border-brand'}`}>{label}</Link>
  }
  const range = !report.date ? '' : from && to ? `${report.date}: ${fmtWeekday(from)} to ${fmtWeekday(to)}` : from ? `${report.date}: from ${fmtWeekday(from)}` : to ? `${report.date}: up to ${fmtWeekday(to)}` : `${report.date}: all dates`
  return (
    <>
      <PageHeader title={report.title} crumb={<Link href="/report" className="hover:underline">All reports</Link>} sub={[report.about, range].filter(Boolean).join(' · ')} />
      <form action={`/report/${kind}`} className="card flex flex-wrap items-end gap-3 px-5 py-4">
        {report.date && (
          <>
            <div className="w-40"><label className="label">{report.date} from</label><DateField name="from" defaultValue={from ? dayInput(from) : ''} compact /></div>
            <div className="w-40"><label className="label">To</label><DateField name="to" defaultValue={to ? dayInput(to) : ''} compact /></div>
          </>
        )}
        {report.status && (
          <div className="w-44"><label className="label" htmlFor="f-status">Status</label><select id="f-status" name="status" defaultValue={status ?? ''} className="input py-2"><option value="">All</option>{report.status.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        )}
        {report.region && (
          <div className="w-44"><label className="label" htmlFor="f-region">Region</label><select id="f-region" name="region" defaultValue={regionId ?? ''} className="input py-2"><option value="">All regions</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        )}
        {(report.date || report.status || report.region) && <button className="btn">Apply</button>}
        {(status || regionId || !untouched) && <Link href={`/report/${kind}`} className="btn-secondary">Reset</Link>}
        {report.date && (
          <div className="flex w-full flex-wrap gap-1.5">
            {preset('Today', today, today)}
            {preset('This week', weekStart, today)}
            {preset('This month', monthStart, today)}
            {preset('Last month', lastMonthStart, addDays(monthStart, -1))}
            {preset('All dates', null, null)}
          </div>
        )}
      </form>
      {rows.length >= 3000 && <p className="text-[13px] font-medium text-warn">Showing the newest 3,000 rows. Narrow the dates to see the rest.</p>}
      <ReportTable columns={report.columns} rows={rows} fileName={`mukkani-${kind}${from ? `-${dayInput(from)}` : ''}${to ? `-to-${dayInput(to)}` : ''}`} />
    </>
  )
}
