import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { addDays, day, dayInput, fmtWeekday, parseDay } from '@/lib/dates'
import { mapsKeys } from '@/lib/delivery'
import { Callout, Card, Chip, Empty, PageHeader, Tile, Tiles } from '@/components/ui'
import { LiveMap } from './LiveMap'

const TZ = 'Asia/Kolkata'
const time = (d: Date | null) => (d ? new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(d).toLowerCase() : '—')
const minutesOfDay = (d: Date) => {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ }).format(d).split(':')
  return Number(h) * 60 + Number(m)
}
const took = (a: Date, b: Date | null) => {
  if (!b) return '—'
  const m = Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000))
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
}
const ago = (d: Date) => {
  const m = Math.round((Date.now() - d.getTime()) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : time(d)
}
const LATE_FINISH = 8 * 60 // after 8:00 am

// Admin: every delivery person's start and finish time per day, and where they are right now.
export default async function DeliveryLogPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['ADMIN'])
  const sp = await searchParams
  const to = sp.to ? parseDay(sp.to) : day(0)
  const from = sp.from ? parseDay(sp.from) : addDays(to, -13)
  const [rounds, regions, today] = await Promise.all([
    db.deliveryRound.findMany({ where: { date: { gte: from, lte: to } }, include: { user: { include: { deliveryRegions: { select: { name: true } } } } }, orderBy: [{ date: 'desc' }, { loginAt: 'asc' }] }),
    db.region.findMany({ include: { deliveryUser: { select: { name: true } } }, orderBy: { name: 'asc' } }),
    db.deliveryRound.findMany({ where: { date: day(0) }, include: { user: true } }),
  ])
  const live = today.filter((r) => r.lastLat != null && r.lastLng != null && r.lastAt)
  const centre = regions.find((r) => r.lat != null) ?? { lat: 10.85, lng: 78.69 }
  const unassigned = regions.filter((r) => !r.deliveryUser)
  const done = today.reduce((a, r) => a + r.done, 0)
  const total = today.reduce((a, r) => a + r.total, 0)
  return (
    <>
      <PageHeader title="Delivery log" crumb="Delivery" sub="Start and finish time of every round, and where each delivery person is now. Customers never see this.">
        <Link href="/delivery" className="btn-secondary">Open phone screen</Link>
      </PageHeader>
      {unassigned.length > 0 && (
        <Callout tone="warn">
          No delivery person for {unassigned.map((r) => r.name).join(', ')}. <Link href="/admin/users" className="font-semibold underline">Assign in Team + regions</Link>
        </Callout>
      )}
      <Tiles cols={4}>
        <Tile label="Out today" value={today.length} sub="delivery people logged in" tone="brand" />
        <Tile label="Delivered" value={`${done} of ${total}`} tone="leaf" />
        <Tile label="Missed" value={today.reduce((a, r) => a + r.missed, 0)} tone="red" />
        <Tile label="Finished" value={`${today.filter((r) => r.finishedAt).length} of ${today.length}`} sub="rounds" />
      </Tiles>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
        <section className="card overflow-hidden" style={{ height: 380 }}>
          <LiveMap apiKey={mapsKeys().browser} centre={{ lat: centre.lat!, lng: centre.lng! }} people={live.map((r) => ({ id: r.id, name: r.user.name, lat: r.lastLat!, lng: r.lastLng!, ago: ago(r.lastAt!) }))} />
        </section>
        <Card title="Right now" sub="Updates every 30 seconds while their Today screen is open">
          {today.length === 0 ? (
            <Empty>Nobody has logged in today.</Empty>
          ) : (
            <div className="space-y-2.5">
              {today.map((r) => (
                <div key={r.id} className="flex items-center gap-2.5 rounded-lg bg-s2 p-2.5 text-[13px]">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{r.user.name}</div>
                    <div className="text-muted">{r.done + r.missed} of {r.total} stops · {r.lastAt ? `seen ${ago(r.lastAt)}` : 'no position yet'}</div>
                  </div>
                  {r.finishedAt ? <Chip label={`Done ${time(r.finishedAt)}`} tone="leaf" /> : <Chip label="On the road" tone="sky" />}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <section className="card overflow-x-auto">
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold">Every day</h2>
            <p className="text-[13px] text-muted">Start = first time they opened Today. Finish = last stop marked. Finishes after 8:00 am are red.</p>
          </div>
          <form className="flex items-center gap-2">
            <input type="date" name="from" defaultValue={dayInput(from)} className="input py-2" aria-label="From" />
            <input type="date" name="to" defaultValue={dayInput(to)} className="input py-2" aria-label="To" />
            <button className="btn-secondary btn-sm">Show</button>
          </form>
        </div>
        {rounds.length === 0 ? (
          <Empty>No rounds in these dates.</Empty>
        ) : (
          <table className="w-full">
            <thead><tr><th className="th">Date</th><th className="th">Delivery person</th><th className="th">Region</th><th className="th">Start</th><th className="th">Finish</th><th className="th">Time taken</th><th className="th">Delivered</th><th className="th">Missed</th></tr></thead>
            <tbody>
              {rounds.map((r) => {
                const late = r.finishedAt && minutesOfDay(r.finishedAt) > LATE_FINISH
                return (
                  <tr key={r.id}>
                    <td className="td">{fmtWeekday(r.date)}</td>
                    <td className="td font-semibold">{r.user.name}</td>
                    <td className="td">{r.user.deliveryRegions.map((x) => x.name).join(', ') || '—'}</td>
                    <td className="td">{time(r.loginAt)}</td>
                    <td className={`td ${late ? 'font-semibold text-red' : ''}`}>{r.finishedAt ? time(r.finishedAt) : r.date.getTime() === day(0).getTime() ? 'On the road' : 'Not finished'}</td>
                    <td className="td">{took(r.loginAt, r.finishedAt)}</td>
                    <td className="td">{r.done} of {r.total}</td>
                    <td className={`td ${r.missed ? 'text-red' : ''}`}>{r.missed}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
