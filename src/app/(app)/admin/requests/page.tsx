import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { fmtDay, fmtTime, fmtWeekday } from '@/lib/dates'
import { ROLE } from '@/lib/labels'
import { Chip, Empty, PageHeader, Tile, Tiles } from '@/components/ui'
import { decideDayRequest } from '../../ops-actions'

// Requests from sales and the kitchen manager to change a past day. Allowing one opens that day for that
// person for 24 hours; they are told on their own screen.
export default async function DayRequestsPage() {
  await requireUser(['ADMIN'])
  const [requests, users] = await Promise.all([
    db.dayRequest.findMany({ orderBy: [{ createdAt: 'desc' }], take: 200 }),
    db.user.findMany({ select: { id: true, name: true, role: true } }),
  ])
  const who = (id: string) => users.find((u) => u.id === id)
  const now = new Date()
  const pending = requests.filter((r) => r.status === 'PENDING')
  const open = requests.filter((r) => r.status === 'ALLOWED' && r.expiresAt && r.expiresAt > now)
  const rest = requests.filter((r) => r.status !== 'PENDING')
  return (
    <>
      <PageHeader title="Past-day requests" crumb="Business" sub="Sales and the kitchen manager can change today freely. To change an older day they ask here. Calls are not locked." />
      <Tiles cols={3}>
        <Tile label="Waiting for you" value={pending.length} sub="allow or refuse" tone={pending.length ? 'red' : 'muted'} />
        <Tile label="Open right now" value={open.length} sub="allowed, within 24 hours" tone="warn" />
        <Tile label="All requests" value={requests.length} sub="latest 200" />
      </Tiles>
      <section className="card overflow-x-auto">
        <div className="px-5 py-4"><h2 className="font-display text-lg font-semibold">Waiting for you · {pending.length}</h2><p className="text-[13px] text-muted">Allowing opens that one day for that one person for 24 hours</p></div>
        {pending.length === 0 ? <Empty>No requests waiting.</Empty> : (
          <table className="w-full">
            <thead><tr><th className="th">Asked by</th><th className="th">Day to change</th><th className="th">Screen</th><th className="th">Reason</th><th className="th">Asked</th><th className="th"></th></tr></thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id}>
                  <td className="td"><div className="font-semibold">{who(r.userId)?.name ?? '—'}</div><div className="text-[11px] text-muted">{who(r.userId) ? ROLE[who(r.userId)!.role][0] : ''}</div></td>
                  <td className="td font-semibold whitespace-nowrap">{fmtWeekday(r.date)}</td>
                  <td className="td">{r.area}</td>
                  <td className="td max-w-80">{r.note ?? '—'}</td>
                  <td className="td whitespace-nowrap">{fmtDay(r.createdAt)} · {fmtTime(r.createdAt)}</td>
                  <td className="td">
                    <form action={decideDayRequest} className="flex justify-end gap-1.5">
                      <input type="hidden" name="id" value={r.id} />
                      <button name="decision" value="allow" className="btn btn-sm">Allow for 24 hours</button>
                      <button name="decision" value="refuse" className="btn-secondary btn-sm text-red">Refuse</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {rest.length > 0 && (
        <section className="card overflow-x-auto">
          <div className="px-5 py-4"><h2 className="font-display text-lg font-semibold">Earlier requests</h2></div>
          <table className="w-full">
            <thead><tr><th className="th">Asked by</th><th className="th">Day</th><th className="th">Screen</th><th className="th">Reason</th><th className="th">Decision</th><th className="th">Decided</th></tr></thead>
            <tbody>
              {rest.map((r) => (
                <tr key={r.id}>
                  <td className="td">{who(r.userId)?.name ?? '—'}</td>
                  <td className="td whitespace-nowrap">{fmtWeekday(r.date)}</td>
                  <td className="td">{r.area}</td>
                  <td className="td max-w-80 text-muted">{r.note ?? '—'}</td>
                  <td className="td">{r.status === 'REFUSED' ? <Chip label="Refused" tone="red" /> : r.expiresAt && r.expiresAt > now ? <Chip label={`Open till ${fmtTime(r.expiresAt)}`} tone="warn" /> : <Chip label="Allowed, now closed" tone="muted" />}</td>
                  <td className="td whitespace-nowrap">{r.decidedAt ? `${fmtDay(r.decidedAt)} · ${fmtTime(r.decidedAt)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}
