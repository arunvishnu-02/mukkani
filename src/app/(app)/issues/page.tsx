import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { day, dayInput, fmtWeekday } from '@/lib/dates'
import { ISSUE_DEPARTMENTS, ISSUE_STATUS } from '@/lib/labels'
import { Drawer, Empty, ErrorNote, PageHeader, Pills, StatusChip, Tabs, Tile, Tiles } from '@/components/ui'
import { ConfirmButton } from '@/components/ConfirmButton'
import { DateField } from '@/components/DateField'
import { Reveal } from '@/components/Reveal'
import { deleteIssue, saveIssue, setIssueStatus } from '../ops-actions'

// Daily issue register: date, department, issue, responsible person, status, follow-up, remarks.
export default async function IssuesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(['SALES'])
  const sp = await searchParams
  const tab = sp.tab === 'done' || sp.tab === 'all' ? sp.tab : 'open'
  const where = tab === 'open' ? { status: { not: 'DONE' } } : tab === 'done' ? { status: 'DONE' } : {}
  const [issues, open, today, solvedWeek, users] = await Promise.all([
    db.issue.findMany({ where, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 300 }),
    db.issue.count({ where: { status: { not: 'DONE' } } }),
    db.issue.count({ where: { date: day(0) } }),
    db.issue.count({ where: { status: 'DONE', updatedAt: { gte: day(-7) } } }),
    db.user.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { name: true } }),
  ])
  const list = `/issues?tab=${tab}`
  const edit = sp.edit ? issues.find((i) => i.id === sp.edit) ?? (await db.issue.findUnique({ where: { id: sp.edit } })) : null
  const known = !!edit && ISSUE_DEPARTMENTS.includes(edit.department)
  const old = issues.filter((i) => i.status !== 'DONE' && i.date < day(-2)).length
  return (
    <>
      <PageHeader title="Daily issues" sub="Write down every problem of the day, who looks after it and where it stands.">
        <Link href={`${list}&add=1`} scroll={false} className="btn">Add issue</Link>
      </PageHeader>
      <ErrorNote error={sp.error} />
      <Tiles cols={4}>
        <Tile label="Open issues" value={open} sub="not solved yet" tone="red" />
        <Tile label="Added today" value={today} sub={fmtWeekday(day(0))} />
        <Tile label="Open for 3+ days" value={tab === 'done' ? '–' : old} sub="follow these up first" tone="warn" />
        <Tile label="Solved this week" value={solvedWeek} tone="leaf" />
      </Tiles>
      <Tabs items={[{ label: `Open ${open}`, href: '/issues', active: tab === 'open' }, { label: 'Solved', href: '/issues?tab=done', active: tab === 'done' }, { label: 'All', href: '/issues?tab=all', active: tab === 'all' }]} />
      <section className="card overflow-x-auto">
        {issues.length === 0 ? <Empty>{tab === 'open' ? 'No open issues. Tap Add issue when something goes wrong.' : 'No issues here.'}</Empty> : (
          <table className="w-full">
            <thead><tr><th className="th">Date</th><th className="th">Department</th><th className="th">Issue</th><th className="th">Responsible</th><th className="th">Status</th><th className="th">Follow-up</th><th className="th">Remarks</th><th className="th"></th></tr></thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.id} className="align-top">
                  <td className="td whitespace-nowrap">{fmtWeekday(i.date)}</td>
                  <td className="td">{i.department}</td>
                  <td className="td max-w-80 font-semibold whitespace-pre-line">{i.issue}</td>
                  <td className="td">{i.responsible ?? '—'}</td>
                  <td className="td"><StatusChip map={ISSUE_STATUS} value={i.status} /></td>
                  <td className="td max-w-56 text-muted whitespace-pre-line">{i.followUp ?? '—'}</td>
                  <td className="td max-w-56 text-muted whitespace-pre-line">{i.remarks ?? '—'}</td>
                  <td className="td">
                    <div className="flex justify-end gap-1.5">
                      {i.status !== 'DONE' && (
                        <form action={setIssueStatus}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="back" value={list} /><button name="status" value="DONE" className="btn-secondary btn-sm">Solved</button></form>
                      )}
                      <Link href={`${list}&edit=${i.id}`} scroll={false} className="btn-secondary btn-sm">Edit</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {(sp.add || edit) && (
        <Drawer title={edit ? 'Edit issue' : 'Add issue'} sub="One issue per entry, so each can be followed up" close={list}>
          <form action={saveIssue} className="space-y-3.5">
            {edit && <input type="hidden" name="id" value={edit.id} />}
            <input type="hidden" name="back" value={list} />
            <input type="hidden" name="self" value={edit ? `${list}&edit=${edit.id}` : `${list}&add=1`} />
            <div className="grid grid-cols-2 gap-2.5">
              <div><label className="label">Date *</label><DateField name="date" required defaultValue={dayInput(edit?.date ?? day(0))} max={dayInput(day(0))} /></div>
              <div>
                <label className="label" htmlFor="issue-dept">Department *</label>
                <select id="issue-dept" name="department" className="input" defaultValue={!edit ? 'Sales' : known ? edit.department : 'Other'}>{ISSUE_DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select>
              </div>
            </div>
            <Reveal name="department" values={['Other']} initial={!edit ? 'Sales' : known ? edit.department : 'Other'}>
              <div><label className="label" htmlFor="issue-dept-other">Which department? *</label><input id="issue-dept-other" name="departmentOther" className="input" defaultValue={edit && !known ? edit.department : ''} placeholder="Type the department" /></div>
            </Reveal>
            <div><label className="label" htmlFor="issue-text">Issue *</label><textarea id="issue-text" name="issue" rows={3} required className="input" defaultValue={edit?.issue} placeholder="What happened? For example: box delivered late to Srirangam" /></div>
            <div>
              <label className="label" htmlFor="issue-who">Responsible person *</label>
              <input id="issue-who" name="responsible" list="issue-people" required className="input" defaultValue={edit?.responsible ?? ''} placeholder="Who will solve it" />
              <datalist id="issue-people">{users.map((u) => <option key={u.name} value={u.name} />)}</datalist>
            </div>
            <div><span className="label">Status</span><Pills name="status" value={edit?.status ?? 'OPEN'} options={Object.entries(ISSUE_STATUS).map(([k, v]) => [k, v[0]])} tones={{ OPEN: 'red', IN_PROGRESS: 'warn', DONE: 'leaf' }} /></div>
            <div><label className="label" htmlFor="issue-follow">Follow-up</label><textarea id="issue-follow" name="followUp" rows={2} className="input" defaultValue={edit?.followUp ?? ''} placeholder="What was done, or what will be done and when" /></div>
            <div><label className="label" htmlFor="issue-remarks">Remarks</label><textarea id="issue-remarks" name="remarks" rows={2} className="input" defaultValue={edit?.remarks ?? ''} /></div>
            <div className="grid grid-cols-2 gap-2.5"><Link href={list} className="btn-secondary">Cancel</Link><button className="btn">Save issue</button></div>
          </form>
          {edit && (
            <form action={deleteIssue} className="mt-3 border-t border-line pt-3">
              <input type="hidden" name="id" value={edit.id} /><input type="hidden" name="back" value={list} />
              <ConfirmButton message="Delete this issue? This cannot be undone." className="btn-secondary btn-sm text-red">Delete issue</ConfirmButton>
            </form>
          )}
        </Drawer>
      )}
    </>
  )
}
