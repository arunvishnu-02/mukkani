import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { ROLE } from '@/lib/labels'
import { period, teamFigures } from '@/lib/report'
import { Card, Chip, ErrorNote, PageHeader, StatusChip, Who } from '@/components/ui'
import { saveRegion, saveUser } from '../actions'

export default async function UsersRegions({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['ADMIN'])
  const sp = await searchParams
  const month = period('month')
  const [users, regions, team] = await Promise.all([
    db.user.findMany({ orderBy: [{ role: 'asc' }, { name: 'asc' }] }),
    db.region.findMany({ orderBy: { name: 'asc' }, include: { owner: true, _count: { select: { leads: true } } } }),
    teamFigures(month),
  ])
  const editUser = sp.user === 'new' ? null : users.find((u) => u.id === sp.user)
  const editRegion = sp.region === 'new' ? null : regions.find((r) => r.id === sp.region)
  const showUser = sp.user === 'new' || !!editUser
  const showRegion = sp.region === 'new' || !!editRegion
  return (
    <>
      <PageHeader title="Team + regions" crumb="Business" sub="Who can log in, what they can do, and the delivery areas">
        <Link href="/admin/users?region=new" className="btn-secondary">Add region</Link>
        <Link href="/admin/users?user=new" className="btn">Add user</Link>
      </PageHeader>
      <ErrorNote error={sp.error} />
      {showUser && (
        <form action={saveUser} className="card grid gap-3 border-brand p-5 sm:grid-cols-3">
          <input type="hidden" name="id" value={editUser?.id ?? ''} />
          <h2 className="font-display text-lg font-semibold sm:col-span-3">{editUser ? `Edit ${editUser.name}` : 'Add user'}</h2>
          <div><label className="label">Name</label><input name="name" className="input" defaultValue={editUser?.name} required /></div>
          <div><label className="label">Username</label><input name="username" className="input" defaultValue={editUser?.username} required /></div>
          <div><label className="label">{editUser ? 'New password (leave empty to keep)' : 'Password'}</label><input name="password" type="password" className="input" minLength={6} required={!editUser} /></div>
          <div><label className="label">Role</label><select name="role" className="input" defaultValue={editUser?.role ?? 'SALES'}>{Object.entries(ROLE).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className="label">Phone</label><input name="phone" className="input" defaultValue={editUser?.phone ?? ''} /></div>
          <div><label className="label">Status</label><select name="active" className="input" defaultValue={editUser?.active === false ? 'off' : 'on'}><option value="on">Active</option><option value="off">Inactive (cannot log in)</option></select></div>
          <div className="flex gap-2.5 sm:col-span-3"><Link href="/admin/users" className="btn-secondary">Cancel</Link><button className="btn">Save user</button></div>
        </form>
      )}
      {showRegion && (
        <form action={saveRegion} className="card grid gap-3 border-brand p-5 sm:grid-cols-4">
          <input type="hidden" name="id" value={editRegion?.id ?? ''} />
          <h2 className="font-display text-lg font-semibold sm:col-span-4">{editRegion ? `Edit ${editRegion.name}` : 'Add region'}</h2>
          <div><label className="label">Name</label><input name="name" className="input" defaultValue={editRegion?.name} required /></div>
          <div><label className="label">Centre latitude</label><input name="lat" className="input" inputMode="decimal" defaultValue={editRegion?.lat ?? ''} /></div>
          <div><label className="label">Centre longitude</label><input name="lng" className="input" inputMode="decimal" defaultValue={editRegion?.lng ?? ''} /></div>
          <div><label className="label">Sales owner</label><select name="ownerId" className="input" defaultValue={editRegion?.ownerId ?? ''}><option value="">None</option>{users.filter((u) => u.role === 'SALES').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <p className="text-xs text-muted sm:col-span-4">The centre is used to set a customer&apos;s region automatically from their shared pin (nearest centre within 25 km).</p>
          <div className="flex gap-2.5 sm:col-span-4"><Link href="/admin/users" className="btn-secondary">Cancel</Link><button className="btn">Save region</button></div>
        </form>
      )}
      <section className="card overflow-x-auto">
        <h2 className="px-5 py-4 font-display text-lg font-semibold">Users <span className="text-sm font-normal text-muted">{users.length} people</span></h2>
        <table className="w-full">
          <thead><tr><th className="th">Name</th><th className="th">Username</th><th className="th">Role</th><th className="th">Phone</th><th className="th">This month</th><th className="th">Status</th><th className="th"></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="td"><Who name={u.name} /></td>
                <td className="td font-mono text-xs">{u.username}</td>
                <td className="td"><StatusChip map={ROLE} value={u.role} /></td>
                <td className="td">{u.phone ?? '—'}</td>
                <td className="td text-[13px]">{(() => {
                  const t = team.find((x) => x.user.id === u.id)
                  return t ? `${t.leads} leads · ${t.calls} calls · ${t.trials} trials · ${t.monthly} monthly` : <span className="text-muted">—</span>
                })()}</td>
                <td className="td">{u.active ? <Chip label="Active" tone="leaf" /> : <Chip label="Inactive" tone="muted" />}</td>
                <td className="td"><Link href={`/admin/users?user=${u.id}`} className="btn-secondary btn-sm">Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
        <section className="card overflow-x-auto">
          <div className="px-5 py-4"><h2 className="font-display text-lg font-semibold">Regions</h2><p className="text-[13px] text-muted">Delivery areas used for leads, boxes and reports</p></div>
          <table className="w-full">
            <thead><tr><th className="th">Region</th><th className="th">Leads</th><th className="th">Sales owner</th><th className="th">Centre</th><th className="th"></th></tr></thead>
            <tbody>
              {regions.map((r) => (
                <tr key={r.id}>
                  <td className="td">{r.name}</td>
                  <td className="td">{r._count.leads}</td>
                  <td className="td">{r.owner?.name ?? '—'}</td>
                  <td className="td font-mono text-xs">{r.lat != null ? `${r.lat.toFixed(3)}, ${r.lng?.toFixed(3)}` : 'not set'}</td>
                  <td className="td"><Link href={`/admin/users?region=${r.id}`} className="btn-secondary btn-sm">Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <Card title="What each role can do">
          <div className="space-y-2.5">
            {[
              ['ADMIN', 'Everything: sales and kitchen screens, reports, purchase + expenses, team, regions and settings'],
              ['SALES', 'Leads, call register, trials, monthly packs, daily menu, delivery attendance, reminders and monthly reports'],
              ['KITCHEN', 'Today’s boxes and the 3 AM sheet, customer status, customer calls, alternative boxes, stock and wastage. Cannot delete.'],
            ].map(([r, d]) => (
              <div key={r} className="space-y-1.5 rounded-[10px] bg-s2 p-3">
                <StatusChip map={ROLE} value={r} />
                <p className="text-[13px] leading-[18px]">{d}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
