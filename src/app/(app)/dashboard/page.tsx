import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { day, fmtWeekday, isSunday, longToday, nowHourIST } from '@/lib/dates'
import { LEAD_STATUS } from '@/lib/labels'
import { birthdaysToday, daySheet, runningPackages } from '@/lib/queries'
import { getSettings } from '@/lib/settings'
import { fill, firstName, waLink } from '@/lib/whatsapp'
import { Card, Chip, PageHeader, StatusChip, Tile, Tiles, WaLink, Who } from '@/components/ui'

function Todo({ done, title, sub, href, cta }: { done: boolean; title: string; sub: string; href: string; cta: string }) {
  return (
    <div className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
      <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-leaf text-white' : 'border-2 border-line'}`}>{done ? '✓' : ''}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted">{sub}</div>
      </div>
      <Link href={href} className={done ? 'btn-secondary btn-sm' : 'btn btn-sm'}>{cta}</Link>
    </div>
  )
}

export default async function SalesDashboard() {
  const user = await requireUser(['SALES'])
  const today = day(0)
  const tomorrow = isSunday(day(1)) ? day(2) : day(1)
  const [callsToday, overdue, feedback, trialsTomorrow, menuTomorrow, sheet, running, birthdays, st, recent] = await Promise.all([
    db.lead.count({ where: { status: 'FOLLOW_UP', nextFollowUpAt: today } }),
    db.lead.count({ where: { status: 'FOLLOW_UP', nextFollowUpAt: { lt: today } } }),
    db.trialBox.count({ where: { status: { not: 'DONE' }, deliveryDate: { lte: today } } }),
    db.trialBox.count({ where: { deliveryDate: tomorrow } }),
    db.menu.findUnique({ where: { date: tomorrow } }),
    daySheet(today),
    runningPackages(today),
    birthdaysToday(),
    getSettings(),
    db.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 6, include: { region: true } }),
  ])
  const total = sheet.rows.length + sheet.trials.length
  const reminders = running.filter((r) => r.plan.end && r.plan.end >= today && r.plan.end <= day(3) && !r.pkg.reminderSentAt).length
  return (
    <>
      <PageHeader title={`Good ${nowHourIST() < 12 ? 'morning' : 'afternoon'}, ${firstName(user.name)}`} sub={longToday()} />
      <Tiles cols={5}>
        <Tile label="Calls today" value={callsToday} sub={overdue ? `${overdue} overdue` : 'none overdue'} tone="warn" />
        <Tile label="Trial feedback calls" value={feedback} sub="after 10 AM on the trial day" tone="sky" />
        <Tile label="Trials tomorrow" value={trialsTomorrow} sub={fmtWeekday(tomorrow)} tone="brand" />
        <Tile label="Monthly customers" value={running.length} sub={`${sheet.boxes} boxes today`} tone="leaf" />
        <Tile label="Birthdays today" value={birthdays.length} sub="send a wish" tone="red" />
      </Tiles>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
        <Card title="Today's work" sub="The daily routine from the plan">
          <Todo done={callsToday + overdue === 0} title="Follow-up calls" sub={`${callsToday} due today, ${overdue} overdue`} href="/calls" cta="Call register" />
          <Todo done={feedback === 0} title="Trial feedback calls" sub={`${feedback} waiting for a result`} href="/trials?tab=waiting" cta="Trials" />
          <Todo done={!!menuTomorrow} title={`Add the menu for ${fmtWeekday(tomorrow)}`} sub={menuTomorrow ? `${menuTomorrow.fruits}` : 'The kitchen prints the sheet at 3 AM'} href="/menu" cta={menuTomorrow ? 'View' : 'Add menu'} />
          <Todo done={total > 0 && sheet.entered >= total} title="Enter today's attendance" sub={`${sheet.entered} of ${total} entered. After 11 AM, from the paper sheet.`} href="/attendance" cta="Enter" />
          <Todo done={reminders === 0} title="End-date reminders" sub={`${reminders} to send on WhatsApp`} href="/reminders" cta="Reminders" />
        </Card>
        <div className="space-y-4">
          <Card title="Birthdays today">
            {birthdays.length === 0 ? (
              <p className="text-sm text-muted">No birthdays today.</p>
            ) : (
              <div className="space-y-2.5">
                {birthdays.map((b) => (
                  <div key={b.id} className="flex items-center gap-2.5">
                    <div className="flex-1"><Who name={b.name} sub={b.phone} href={`/customers/${b.id}`} /></div>
                    <WaLink small href={waLink(b.phone, fill(st.msgBirthday, { name: firstName(b.name) }))}>Wish</WaLink>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="New leads" right={<Link href="/leads?new=1" className="btn-secondary btn-sm">Add lead</Link>}>
            <div className="space-y-2.5">
              {recent.map((l) => (
                <div key={l.id} className="flex items-center gap-2.5">
                  <div className="flex-1"><Who name={l.name} sub={l.region?.name ?? l.phone} href={`/leads?lead=${l.id}`} /></div>
                  <StatusChip map={LEAD_STATUS} value={l.status} />
                </div>
              ))}
              {recent.length === 0 && <Chip label="No leads yet" tone="muted" />}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
