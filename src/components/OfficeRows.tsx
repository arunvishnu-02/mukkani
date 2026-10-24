'use client'

import { useState } from 'react'

export type OfficeInit = { id: string; name: string; d: { attendance: string | null; inTime: string | null; outTime: string | null; remarks: string | null } | null }

function Row({ s }: { s: OfficeInit }) {
  const [att, setAtt] = useState(s.d?.attendance ?? '')
  const here = att === 'PRESENT'
  return (
    <tr className={att === 'ABSENT' ? 'bg-s2/60' : ''}>
      <td className="td font-semibold whitespace-nowrap"><input type="hidden" name="staff" value={s.id} />{s.name}</td>
      <td className="td">
        <div className="flex gap-1.5" role="radiogroup" aria-label="Present or absent">
          {([['PRESENT', 'Present', 'border-leaf bg-leaf text-white'], ['ABSENT', 'Absent', 'border-tur bg-tur text-white']] as const).map(([v, l, on]) => (
            <label key={v} className={`cursor-pointer rounded-md border px-2.5 py-1 text-[13px] font-medium ${att === v ? on : 'border-line bg-surface'}`}>
              <input type="radio" name={`att_${s.id}`} value={v} required checked={att === v} onChange={() => setAtt(v)} className="sr-only" />{l}
            </label>
          ))}
        </div>
      </td>
      {here ? (
        <>
          <td className="td"><input type="time" name={`in_${s.id}`} required defaultValue={s.d?.inTime ?? ''} aria-label="In time" style={{ width: 134 }} className="input px-2 py-1.5 text-[13px]" /></td>
          <td className="td"><input type="time" name={`out_${s.id}`} required defaultValue={s.d?.outTime ?? ''} aria-label="Out time" style={{ width: 134 }} className="input px-2 py-1.5 text-[13px]" /></td>
        </>
      ) : <td className="td text-muted" colSpan={2}>{att === 'ABSENT' ? 'Absent. Nothing else to fill.' : 'Choose Present or Absent first.'}</td>}
      <td className="td"><input name={`remarks_${s.id}`} defaultValue={s.d?.remarks ?? ''} aria-label="Remarks" className="input min-w-40 px-2 py-1.5 text-[13px]" /></td>
    </tr>
  )
}

export function OfficeTable({ rows }: { rows: OfficeInit[] }) {
  return (
    <table className="w-full">
      <thead><tr><th className="th">Name</th><th className="th">Present</th><th className="th">In time</th><th className="th">Out time</th><th className="th">Remarks</th></tr></thead>
      <tbody>{rows.map((s) => <Row key={s.id} s={s} />)}</tbody>
    </table>
  )
}
