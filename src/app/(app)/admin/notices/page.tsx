import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { fmtDay, fmtTime } from '@/lib/dates'
import { ROLE } from '@/lib/labels'
import { Chip, Empty, PageHeader, Tile, Tiles } from '@/components/ui'
import { markNoticesSeen } from '../../ops-actions'
import type { Role } from '@/generated/prisma/enums'

// What sales and the kitchen manager deleted or took back, so admin can see it and put it right if needed.
export default async function NoticesPage() {
  await requireUser(['ADMIN'])
  const notices = await db.adminNotice.findMany({ orderBy: { createdAt: 'desc' }, take: 300 })
  const unseen = notices.filter((n) => !n.seenAt)
  return (
    <>
      <PageHeader title="Team notices" crumb="Business" sub="What sales or the kitchen manager deleted or took back, and when the kitchen could not print the next sheet because the day was not finished.">
        {unseen.length > 0 && <form action={markNoticesSeen}><button className="btn btn-sm">Mark all as seen</button></form>}
      </PageHeader>
      <Tiles cols={2}>
        <Tile label="New for you" value={unseen.length} sub="not seen yet" tone={unseen.length ? 'red' : 'muted'} />
        <Tile label="All notices" value={notices.length} sub="latest 300" />
      </Tiles>
      <section className="card overflow-x-auto">
        {notices.length === 0 ? <Empty>Nothing deleted by the team yet.</Empty> : (
          <table className="w-full">
            <thead><tr><th className="th">When</th><th className="th">Who</th><th className="th">What</th><th className="th">Details</th><th className="th"></th></tr></thead>
            <tbody>
              {notices.map((n) => (
                <tr key={n.id} className={n.seenAt ? '' : 'bg-red-soft'}>
                  <td className="td whitespace-nowrap">{fmtDay(n.createdAt)} · {fmtTime(n.createdAt)}</td>
                  <td className="td"><div className="font-semibold">{n.byName ?? '—'}</div><div className="text-[11px] text-muted">{n.byRole && n.byRole in ROLE ? ROLE[n.byRole as Role][0] : ''}</div></td>
                  <td className="td font-semibold">{n.text}</td>
                  <td className="td max-w-[420px] text-[13px] whitespace-pre-line">{n.detail ?? '—'}</td>
                  <td className="td">{n.seenAt ? '' : <Chip label="New" tone="red" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
