import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { ROLE } from '@/lib/labels'
import { Card, Chip, PageHeader, StatusChip, Who } from '@/components/ui'
import { ConfirmButton } from '@/components/ConfirmButton'
import { deleteRegion, deleteUser, saveRegion, saveUser } from '../../actions'

export default async function UsersRegions({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser(['ADMIN'])
  const sp = await searchParams
  const [users, regions] = await Promise.all([
    db.user.findMany({ orderBy: [{ role: 'asc' }, { name: 'asc' }] }),
    db.region.findMany({ orderBy: { name: 'asc' }, include: { owner: true, _count: { select: { leads: true } } } }),
  ])
  const editUser = sp.user === 'new' ? null : users.find((u) => u.id === sp.user)
  const editRegion = sp.region === 'new' ? null : regions.find((r) => r.id === sp.region)
  const showUser = sp.user === 'new' || !!editUser
  const showRegion = sp.region === 'new' || !!editRegion
  return (
    <>
      <PageHeader title="Users and regions" sub="Who can log in, what they can do, and the delivery areas">
        <Link href="/admin/users?region=new" className="btn-secondary">Add region</Link>
        <Link href="/admin/users?user=new" className="btn">Add user</Link>
      </PageHeader>
      {showUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/45 p-4">
        <form key={editUser?.id ?? 'new'} action={saveUser} className="card grid w-full max-w-[720px] gap-3 p-6 sm:grid-cols-3">
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
        </div>
      )}
      {showRegion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/45 p-4">
        <form key={editRegion?.id ?? 'new'} action={saveRegion} className="card grid w-full max-w-[820px] gap-3 p-6 sm:grid-cols-4">
          <input type="hidden" name="id" value={editRegion?.id ?? ''} />
          <h2 className="font-display text-lg font-semibold sm:col-span-4">{editRegion ? `Edit ${editRegion.name}` : 'Add region'}</h2>
          <div><label className="label">Name</label><input name="name" className="input" defaultValue={editRegion?.name} required /></div>
          <div><label className="label">Centre latitude</label><input name="lat" className="input" inputMode="decimal" defaultValue={editRegion?.lat ?? ''} /></div>
          <div><label className="label">Centre longitude</label><input name="lng" className="input" inputMode="decimal" defaultValue={editRegion?.lng ?? ''} /></div>
          <div><label className="label">Sales owner</label><select name="ownerId" className="input" defaultValue={editRegion?.ownerId ?? ''}><option value="">None</option>{users.filter((u) => u.role === 'SALES').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <p className="text-xs text-muted sm:col-span-4">The centre is used to set a customer&apos;s region automatically from their shared pin (nearest centre within 25 km).</p>
          <div className="flex gap-2.5 sm:col-span-4"><Link href="/admin/users" className="btn-secondary">Cancel</Link><button className="btn">Save region</button></div>
        </form>
        </div>
      )}
      <section className="card overflow-x-auto">
        <h2 className="px-5 py-4 font-display text-lg font-semibold">Users <span className="text-sm font-normal text-muted">{users.length} people</span></h2>
        <table className="w-full">
          <thead><tr><th className="th">Name</th><th className="th">Username</th><th className="th">Role</th><th className="th">Phone</th><th className="th">Status</th><th className="th"></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="td"><Who name={u.name} /></td>
                <td className="td font-mono text-xs">{u.username}</td>
                <td className="td"><StatusChip map={ROLE} value={u.role} /></td>
                <td className="td">{u.phone ?? '—'}</td>
                <td className="td">{u.active ? <Chip label="Active" tone="leaf" /> : <Chip label="Inactive" tone="muted" />}</td>
                <td className="td">
                  <div className="flex justify-end gap-1.5">
                    <Link href={`/admin/users?user=${u.id}`} className="btn-secondary btn-sm">Edit</Link>
                    {u.id !== me.id && (
                      <form action={deleteUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <ConfirmButton message={`Delete ${u.name}? Their leads stay, without an owner.`} className="btn-secondary btn-sm text-red">Delete</ConfirmButton>
                      </form>
                    )}
                  </div>
                </td>
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
                  <td className="td">
                    <div className="flex justify-end gap-1.5">
                      <Link href={`/admin/users?region=${r.id}`} className="btn-secondary btn-sm">Edit</Link>
                      <form action={deleteRegion}>
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmButton message={`Delete ${r.name}? Its ${r._count.leads} leads stay, with no region.`} className="btn-secondary btn-sm text-red">Delete</ConfirmButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <Card title="What each role can do">
          <div className="space-y-2.5">
            {[
              ['ADMIN', 'Everything, including users, regions and reports'],
              ['SALES', 'Leads, follow-ups, customers, trial and regular boxes, location links'],
              ['KITCHEN', 'View only: count tiles, today’s boxes, monthly customers. No action buttons.'],
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
