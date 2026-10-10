import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { addDays, day, dayInput, fmtWeekday, isSunday, parseDay } from '@/lib/dates'
import { splitList } from '@/lib/menu'
import { daySheet, swapTotals } from '@/lib/queries'
import { appSettings } from '@/lib/settings'
import { isButtermilkDay } from '@/lib/plan'
import { Callout, Card, Checks, Chip, Empty, ErrorNote, PageHeader, Tabs, Tile, Tiles, Who } from '@/components/ui'
import { saveMenuAction } from '../actions'

// Sales adds tomorrow's menu today. The app checks it against every customer's foods to avoid.
export default async function MenuPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(['SALES', 'KITCHEN'])
  const sp = await searchParams
  const tab = sp.tab === 'week' || sp.tab === 'past' ? sp.tab : 'tomorrow'
  const tomorrow = isSunday(day(1)) ? day(2) : day(1)
  const date = sp.date ? parseDay(sp.date) : tomorrow
  const canEdit = user.role !== 'KITCHEN'
  const [sheet, st, menus] = await Promise.all([
    daySheet(date),
    appSettings(),
    tab === 'tomorrow' ? [] : db.menu.findMany({ where: tab === 'week' ? { date: { gte: day(0), lte: day(7) } } : { date: { lt: day(0) } }, orderBy: { date: tab === 'week' ? 'asc' : 'desc' }, take: 30 }),
  ])
  const menu = sheet.menu
  const swaps = [...sheet.rows.filter((r) => r.swap && !r.absent).map((r) => ({ lead: r.lead, swap: r.swap! })), ...sheet.trials.filter((t) => t.swap).map((t) => ({ lead: t.trial.lead, swap: t.swap! }))]
  const totals = swapTotals(swaps.map((s) => s.swap))
  const self = `/menu?date=${dayInput(date)}`
  const nextDays = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(day(0), i)).filter((d) => !isSunday(d))
  return (
    <>
      <PageHeader title={tab === 'tomorrow' ? `Menu for ${fmtWeekday(date)}` : tab === 'week' ? 'This week' : 'Past menus'} crumb="Daily menu" sub="Add today the menu for tomorrow. The app checks it against every customer's foods to avoid and health notes.">
        <Tabs items={[{ label: 'Tomorrow', href: '/menu', active: tab === 'tomorrow' }, { label: 'This week', href: '/menu?tab=week', active: tab === 'week' }, { label: 'Past menus', href: '/menu?tab=past', active: tab === 'past' }]} />
      </PageHeader>
      <ErrorNote error={sp.error} />
      {sp.saved && <Callout>Menu saved. The kitchen sheet now shows who needs a swap.</Callout>}
      {tab !== 'tomorrow' ? (
        <section className="card overflow-x-auto">
          {menus.length === 0 ? <Empty>No menus here yet.</Empty> : (
            <table className="w-full">
              <thead><tr><th className="th">Date</th><th className="th">Fruits</th><th className="th">Salad</th><th className="th">Swap fruits</th><th className="th"></th></tr></thead>
              <tbody>
                {menus.map((m) => (
                  <tr key={m.id}>
                    <td className="td font-semibold whitespace-nowrap">{fmtWeekday(m.date)}</td><td className="td">{m.fruits}</td><td className="td">{m.salad ?? '—'}</td><td className="td">{m.swapFruits || '—'}</td>
                    <td className="td"><Link className="font-semibold text-sky" href={`/menu?date=${dayInput(m.date)}`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {nextDays.map((d) => (
              <Link key={d.toISOString()} href={`/menu?date=${dayInput(d)}`} className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${d.getTime() === date.getTime() ? 'border-brand bg-brand text-white' : 'border-line bg-surface'}`}>{fmtWeekday(d)}</Link>
            ))}
          </div>
          <Tiles cols={4}>
            <Tile label={date.getTime() === day(0).getTime() ? 'Boxes today' : 'Boxes that day'} value={sheet.boxes} sub={`Monthly ${sheet.monthly} · Trial ${sheet.trials.length}`} />
            <Tile label="Need a swap" value={swaps.length} sub="can't have a fruit on the menu" tone="warn" />
            <Tile label="No swap" value={Math.max(0, sheet.boxes - swaps.length)} sub="get the menu as it is" tone="leaf" />
            <Tile label="Buttermilk" value={sheet.buttermilk} sub={isButtermilkDay(date) ? 'bottles that day' : 'Mon, Wed, Fri only'} tone="sky" />
          </Tiles>
          <div className="grid items-start gap-4 lg:grid-cols-[440px_1fr]">
            <Card title={`Menu for ${fmtWeekday(date)}`} sub={canEdit ? "Pick the fruits and salad going in the box" : 'Added by sales'}>
              {canEdit ? (
                <form action={saveMenuAction} className="space-y-4">
                  <input type="hidden" name="date" value={dayInput(date)} />
                  <input type="hidden" name="back" value={self} />
                  <div><span className="label">Fruits *</span><Checks name="fruits" options={st.fruits} values={splitList(menu?.fruits)} /></div>
                  <div><label className="label">Salad</label><input name="salad" className="input" defaultValue={menu?.salad ?? ''} placeholder="For example: sprouts salad with cucumber and carrot" /></div>
                  <div>
                    <span className="label">Swap fruits (given instead)</span>
                    <Checks name="swapFruits" options={st.fruits} values={splitList(menu?.swapFruits)} />
                    <p className="mt-1.5 text-xs text-muted">Customers who cannot have a menu fruit get one of these instead.</p>
                  </div>
                  <div><label className="label">Note for kitchen</label><textarea name="note" rows={2} className="input" defaultValue={menu?.note ?? ''} /></div>
                  <button className="btn w-full">Save menu</button>
                </form>
              ) : menu ? (
                <div className="space-y-2 text-sm">
                  <div><span className="font-semibold">Fruits:</span> {menu.fruits}</div>
                  <div><span className="font-semibold">Salad:</span> {menu.salad ?? '—'}</div>
                  <div><span className="font-semibold">Swap fruits:</span> {menu.swapFruits || '—'}</div>
                  {menu.note && <div><span className="font-semibold">Note:</span> {menu.note}</div>}
                </div>
              ) : (
                <Empty>Sales has not added this menu yet.</Empty>
              )}
            </Card>
            <div className="space-y-4">
              <section className="card overflow-x-auto">
                <div className="px-5 py-4">
                  <h2 className="font-display text-lg font-semibold">Customers who need a swap</h2>
                  <p className="text-[13px] text-muted">Found by matching the menu with each customer&apos;s foods to avoid and health notes</p>
                </div>
                {!menu ? <Empty>Save the menu to see the swap list.</Empty> : swaps.length === 0 ? <Empty>Nobody needs a swap for this menu.</Empty> : (
                  <table className="w-full">
                    <thead><tr><th className="th">Customer</th><th className="th">Avoids</th><th className="th">In menu</th><th className="th">Swap to</th></tr></thead>
                    <tbody>
                      {swaps.map(({ lead, swap }) => (
                        <tr key={lead.id}>
                          <td className="td"><Who name={lead.name} sub={lead.region?.name ?? lead.phone} href={`/customers/${lead.id}`} /></td>
                          <td className="td text-muted">{[lead.avoidFoods, lead.healthNotes].filter(Boolean).join(' · ')}</td>
                          <td className="td">{swap.avoids.join(', ')}</td>
                          <td className="td">{swap.swapTo ? <Chip label={swap.swapTo} tone="brand" /> : <Chip label="Add a swap fruit" tone="red" />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
              {totals.length > 0 && (
                <Card title="Swap fruit to prepare" sub="The kitchen uses this count for production">
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {totals.map(([f, n]) => (
                      <div key={f} className="rounded-[10px] bg-brand-soft px-3.5 py-3">
                        <div className="text-[13px] text-muted">{f}</div>
                        <div className="font-display text-2xl font-bold text-brand">{n} box{n > 1 ? 'es' : ''}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              <Callout tone="brand">The menu is locked in when the kitchen manager prints the attendance sheet at 3 AM.</Callout>
            </div>
          </div>
        </>
      )}
    </>
  )
}
