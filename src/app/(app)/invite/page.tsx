import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { fmtDay, fmtTime } from '@/lib/dates'
import { SOURCE } from '@/lib/labels'
import { waLink } from '@/lib/whatsapp'
import { Callout, Chip, Empty, ErrorNote, PageHeader, Tile, Tiles } from '@/components/ui'
import { CopyButton } from '@/components/CopyButton'
import { createInvite, deleteInvite } from '../ops-actions'

const message = (name: string | null, link: string) => `Hi${name ? ` ${name.split(' ')[0]}` : ''}, this is Mukkani. Please tap the link below and fill in your details and home location, so we can deliver your fresh fruit and salad box.\n${link}`

// Customer form link: type a phone number, send the link on WhatsApp, and the customer's own answers
// (with their home location) arrive as a lead. For sales, admin and the kitchen manager.
export default async function InvitePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser()
  const sp = await searchParams
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const [invites, users] = await Promise.all([
    db.leadInvite.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    db.user.findMany({ select: { id: true, name: true } }),
  ])
  const made = invites.find((i) => i.id === sp.new)
  const by = (id: string | null) => users.find((u) => u.id === id)?.name ?? '—'
  const waiting = invites.filter((i) => !i.filledAt && i.expiresAt > new Date())
  const today = new Date(Date.now() - 24 * 3_600_000)
  const profile = (leadId: string) => (user.role === 'KITCHEN' ? `/customers/${leadId}` : `/leads?f=all&lead=${leadId}`)
  return (
    <>
      <PageHeader title="Customer form link" sub="Type the phone number and send the link. The customer fills in their own details and home location, and it arrives here as a lead." />
      <ErrorNote error={sp.error} />
      <Tiles cols={3}>
        <Tile label="Waiting for the customer" value={waiting.length} sub="link sent, not filled yet" tone="warn" />
        <Tile label="Filled in the last 24 hours" value={invites.filter((i) => i.filledAt && i.filledAt > today).length} sub="now in Leads" tone="leaf" />
        <Tile label="Links sent" value={invites.length} sub="latest 100" />
      </Tiles>
      <div className="grid items-start gap-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <section className="card px-5 py-4">
            <h2 className="font-display text-lg font-semibold">New link</h2>
            <p className="text-[13px] text-muted">Only the phone number is needed</p>
            <form action={createInvite} className="mt-3 space-y-3.5">
              <div><label className="label" htmlFor="inv-phone">Customer phone *</label><input id="inv-phone" name="phone" required inputMode="tel" className="input" placeholder="98430 11223" /></div>
              <div><label className="label" htmlFor="inv-name">Name (if you know it)</label><input id="inv-name" name="name" className="input" /></div>
              <div>
                <label className="label" htmlFor="inv-source">Where the lead came from</label>
                <select id="inv-source" name="source" className="input" defaultValue="WHATSAPP">{Object.entries(SOURCE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </div>
              <button className="btn w-full">Make the link</button>
            </form>
          </section>
          {made && !made.filledAt && (
            <section className="card border-leaf px-5 py-4">
              <h2 className="font-display text-lg font-semibold text-leaf">Link ready for {made.phone}</h2>
              <p className="mt-1 rounded-lg bg-s2 px-3 py-2 font-mono text-xs break-all">{base}/join/{made.token}</p>
              <div className="mt-3 space-y-2">
                <a href={waLink(made.phone, message(made.name, `${base}/join/${made.token}`))} target="_blank" rel="noreferrer" className="btn w-full">Send on WhatsApp</a>
                <CopyButton text={`${base}/join/${made.token}`} />
              </div>
              <p className="mt-2 text-xs text-muted">WhatsApp opens with the message ready. Press send there.</p>
            </section>
          )}
          <Callout tone="sky">When the customer submits, the lead shows up in Leads with the pin, address and region filled in. If the phone number is already a lead, that lead is completed instead of making a second one.</Callout>
        </div>
        <section className="card overflow-x-auto">
          <div className="px-5 py-4"><h2 className="font-display text-lg font-semibold">Links sent</h2><p className="text-[13px] text-muted">A link works for 14 days</p></div>
          {invites.length === 0 ? <Empty>No links yet. Make the first one on the left.</Empty> : (
            <table className="w-full">
              <thead><tr><th className="th">Phone</th><th className="th">Status</th><th className="th">Sent</th><th className="th">By</th><th className="th"></th></tr></thead>
              <tbody>
                {invites.map((i) => {
                  const link = `${base}/join/${i.token}`
                  const expired = !i.filledAt && i.expiresAt <= new Date()
                  return (
                    <tr key={i.id} className={i.id === sp.new ? 'bg-leaf-soft/50' : ''}>
                      <td className="td"><div className="font-semibold">{i.phone}</div>{i.name && <div className="text-[11px] text-muted">{i.name}</div>}</td>
                      <td className="td">{i.filledAt ? <Chip label={`Filled ${fmtDay(i.filledAt)}`} tone="leaf" /> : expired ? <Chip label="Expired" tone="muted" /> : <Chip label="Waiting" tone="warn" />}</td>
                      <td className="td whitespace-nowrap">{fmtDay(i.createdAt)} · {fmtTime(i.createdAt)}</td>
                      <td className="td">{by(i.createdById)}</td>
                      <td className="td">
                        <div className="flex justify-end gap-1.5">
                          {i.filledAt && i.leadId ? <Link href={profile(i.leadId)} className="btn-secondary btn-sm">Open lead</Link> : expired ? null : (
                            <>
                              <a href={waLink(i.phone, message(i.name, link))} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">WhatsApp</a>
                              <Link href={`/invite?new=${i.id}`} scroll={false} className="btn-secondary btn-sm">Link</Link>
                            </>
                          )}
                          {!i.filledAt && <form action={deleteInvite}><input type="hidden" name="id" value={i.id} /><button className="btn-secondary btn-sm text-red">Remove</button></form>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  )
}
