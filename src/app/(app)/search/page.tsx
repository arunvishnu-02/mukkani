import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { fmtDay } from '@/lib/dates'
import { CUSTOMER_STATUS, LEAD_STATUS, SOURCE, sourceLabel } from '@/lib/labels'
import { Chip, Empty, PageHeader, StatusChip, Who } from '@/components/ui'

// One search over every person in the system: leads, trial customers, monthly customers, not interested.
// Matches the name, either phone number (spaces and +91 ignored) and the address.
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser()
  const q = ((await searchParams).q ?? '').trim().slice(0, 80)
  const digits = q.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '')
  const byPhone = digits.length >= 3
    ? await db.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Lead" WHERE regexp_replace("phone", '[^0-9]', '', 'g') LIKE ${`%${digits}%`} OR regexp_replace(coalesce("altPhone", ''), '[^0-9]', '', 'g') LIKE ${`%${digits}%`} LIMIT 60`
    : []
  const people = q.length < 2 ? [] : await db.lead.findMany({
    where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { address: { contains: q, mode: 'insensitive' } }, { id: { in: byPhone.map((r) => r.id) } }] },
    include: { region: true, owner: { select: { name: true } }, packages: { orderBy: { number: 'desc' }, take: 1 }, trialBoxes: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: [{ name: 'asc' }],
    take: 60,
  })
  // Sales edits a plain lead on the Leads screen; anyone who has had a trial or a pack has a customer profile.
  const link = (p: (typeof people)[number]) => (user.role !== 'KITCHEN' && p.packages.length + p.trialBoxes.length === 0 ? `/leads?f=all&lead=${p.id}` : `/customers/${p.id}`)
  return (
    <>
      <PageHeader title="Search" sub={q.length < 2 ? 'Type a name, a phone number or part of an address in the search box on the left.' : `${people.length}${people.length === 60 ? '+' : ''} ${people.length === 1 ? 'person' : 'people'} for "${q}"`} />
      <form action="/search" className="flex max-w-xl gap-2">
        <input name="q" defaultValue={q} autoFocus placeholder="Name, phone or address" className="input" />
        <button className="btn">Search</button>
      </form>
      {q.length >= 2 && (
        <section className="card overflow-x-auto">
          {people.length === 0 ? <Empty>Nobody found. Check the spelling, or try the phone number.</Empty> : (
            <table className="w-full">
              <thead><tr><th className="th">Name</th><th className="th">Region</th><th className="th">Category</th><th className="th">Monthly pack</th><th className="th">Source</th><th className="th">Sales</th><th className="th">Next call</th></tr></thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id}>
                    <td className="td"><Who name={p.name} sub={[p.phone, p.altPhone].filter(Boolean).join(' · ')} href={link(p)} /></td>
                    <td className="td">{p.region?.name ?? '—'}{p.address && <div className="max-w-56 truncate text-[11px] text-muted">{p.address}</div>}</td>
                    <td className="td"><StatusChip map={LEAD_STATUS} value={p.status} /></td>
                    <td className="td">
                      {p.packages[0] ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Chip label={p.packages[0].status === 'ACTIVE' ? `Month ${p.packages[0].number} running` : `Month ${p.packages[0].number} ${p.packages[0].status.toLowerCase()}`} tone={p.packages[0].status === 'ACTIVE' ? 'leaf' : 'muted'} />
                          {p.packages[0].status === 'ACTIVE' && p.customerStatus !== 'ACTIVE' && <StatusChip map={CUSTOMER_STATUS} value={p.customerStatus} />}
                        </span>
                      ) : p.trialBoxes[0] ? <span className="text-muted">Trial {fmtDay(p.trialBoxes[0].deliveryDate)}</span> : <span className="text-muted">—</span>}
                    </td>
                    <td className="td">{sourceLabel(p)}</td>
                    <td className="td">{p.owner?.name ?? '—'}</td>
                    <td className="td">{p.status === 'FOLLOW_UP' ? fmtDay(p.nextFollowUpAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </>
  )
}
