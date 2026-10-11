import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { day, fmtDay, fmtWeekday } from '@/lib/dates'
import { runningPackages } from '@/lib/queries'
import { getSettings } from '@/lib/settings'
import { fill } from '@/lib/whatsapp'
import { Callout, Card, Chip, Empty, PageHeader, Progress, Tabs, Tile, Tiles, Who } from '@/components/ui'
import { sendReminderAction } from '../actions'

// 3 days before a package ends, sales sends the end-date reminder on WhatsApp with one tap.
export default async function RemindersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['SALES'])
  const sp = await searchParams
  const tab = sp.tab === 'sent' || sp.tab === 'all' ? sp.tab : 'send'
  const today = day(0)
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  const [running, st, sentWeek, renewed] = await Promise.all([
    runningPackages(today),
    getSettings(),
    db.package.count({ where: { reminderSentAt: { gte: day(-6) } } }),
    db.package.count({ where: { number: { gt: 1 }, createdAt: { gte: monthStart } } }),
  ])
  const ending = running.filter((r) => r.plan.end && r.plan.end >= today && r.plan.end <= day(7)).sort((a, b) => a.plan.end!.getTime() - b.plan.end!.getTime())
  const toSend = ending.filter((r) => r.plan.end! <= day(3) && !r.pkg.reminderSentAt)
  const sent = ending.filter((r) => r.pkg.reminderSentAt)
  const rows = tab === 'send' ? toSend : tab === 'sent' ? sent : ending
  const sample = toSend[0] ?? ending[0]
  return (
    <>
      <PageHeader title="End-date reminders" crumb="Reminders" sub="3 days before a package ends, send the WhatsApp reminder with one tap. The renewal call on day 26 is made by the kitchen manager.">
        <Tabs items={[{ label: `To send ${toSend.length}`, href: '/reminders', active: tab === 'send' }, { label: 'Sent', href: '/reminders?tab=sent', active: tab === 'sent' }, { label: 'All', href: '/reminders?tab=all', active: tab === 'all' }]} />
      </PageHeader>
      <Tiles cols={4}>
        <Tile label="To send today" value={toSend.length} sub={toSend[0] ? `Packages ending by ${fmtWeekday(toSend[toSend.length - 1].plan.end)}` : 'Nothing due'} tone="warn" />
        <Tile label="Sent this week" value={sentWeek} sub="WhatsApp reminders" tone="leaf" />
        <Tile label="Ending this week" value={ending.length} sub="last delivery in the next 7 days" />
        <Tile label="Renewed this month" value={renewed} sub="paid after the day 26 call" tone="brand" />
      </Tiles>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
        <section className="card overflow-x-auto">
          <div className="px-5 py-4">
            <h2 className="font-display text-lg font-semibold">{tab === 'send' ? 'Send today' : tab === 'sent' ? 'Sent' : 'Ending in the next 7 days'}</h2>
            <p className="text-[13px] text-muted">Tap Send to open WhatsApp with the message ready</p>
          </div>
          {rows.length === 0 ? <Empty>No reminders here.</Empty> : (
            <table className="w-full">
              <thead><tr><th className="th">Customer</th><th className="th">Region</th><th className="th">Package</th><th className="th">Last delivery</th><th className="th">Status</th><th className="th"></th></tr></thead>
              <tbody>
                {rows.map(({ pkg, plan }) => (
                  <tr key={pkg.id}>
                    <td className="td"><Who name={pkg.lead.name} sub={pkg.lead.phone} href={`/customers/${pkg.leadId}`} /></td>
                    <td className="td">{pkg.lead.region?.name ?? '—'}</td>
                    <td className="td"><div className="flex w-32 items-center gap-2"><Progress value={plan.delivered} max={26} /><span className="text-xs font-semibold">{plan.delivered}/26</span></div></td>
                    <td className="td whitespace-nowrap">{fmtWeekday(plan.end)}</td>
                    <td className="td">{pkg.reminderSentAt ? <Chip label="Sent" tone="leaf" /> : <Chip label="To send" tone="warn" />}</td>
                    <td className="td">
                      {pkg.reminderSentAt ? (
                        <span className="text-xs text-muted">Sent {fmtDay(pkg.reminderSentAt)}</span>
                      ) : (
                        <form action={sendReminderAction}>
                          <input type="hidden" name="packageId" value={pkg.id} />
                          <button className="inline-flex rounded-lg bg-leaf px-3 py-1.5 text-[13px] font-semibold text-white">Send</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <div className="space-y-4">
          <Card title="Message" sub="Admin can edit the text in Settings">
            <div className="rounded-[10px] bg-leaf-soft px-4 py-3 text-[13px] leading-5">
              {fill(st.msgReminder, { name: sample ? sample.pkg.lead.name.split(' ')[0] : 'Meena', endDate: fmtWeekday(sample?.plan.end ?? day(3)) })}
              <div className="mt-2 text-[11px] text-muted">Mukkani · {st.businessPhone}</div>
            </div>
          </Card>
          <Callout tone="brand">Sunday is a company holiday and is not counted in the 26 days.</Callout>
        </div>
      </div>
    </>
  )
}
