'use client'

import { useState } from 'react'
import { DELIVERY_IN, SHIFT1, SHIFT2 } from '@/lib/shifts'

export type StaffInit = { id: string; name: string; shift2?: boolean; d: { attendance: string | null; idCard: string | null; uniform: string | null; onTimePickup: boolean | null; inTime: string | null; outTime: string | null; inTime2: string | null; outTime2: string | null; startKm: number | null; endKm: number | null; remarks: string | null } | null }


const cell = 'input px-2 py-1.5 text-[13px]'
function Three({ name, value, label }: { name: string; value: string | null | undefined; label: string }) {
  return (
    <select name={name} required defaultValue={value ?? ''} aria-label={label} style={{ width: 118, minWidth: 118 }} className={`${cell} ${value === 'NO' ? 'border-red text-red' : ''}`}>
      <option value="">Choose</option><option value="YES">Yes</option><option value="NO">No</option><option value="NONE">Don&apos;t have</option>
    </select>
  )
}
const Time = ({ name, value, label, min, max }: { name: string; value: string | null | undefined; label: string; min?: string; max?: string }) => (
  <input type="time" name={name} required defaultValue={value ?? ''} min={min} max={max} aria-label={label} title={min && max ? `${min} to ${max}` : undefined} style={{ width: 134, minWidth: 134 }} className={cell} />
)

function Attend({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Present or absent">
      {([['PRESENT', 'Present', 'border-leaf bg-leaf text-white'], ['ABSENT', 'Absent', 'border-tur bg-tur text-white']] as const).map(([v, l, on]) => (
        <label key={v} className={`cursor-pointer rounded-md border px-2.5 py-1 text-[13px] font-medium ${value === v ? on : 'border-line bg-surface'}`}>
          <input type="radio" name={`att_${id}`} value={v} required checked={value === v} onChange={() => onChange(v)} className="sr-only" />{l}
        </label>
      ))}
    </div>
  )
}

function Row({ kind, s }: { kind: 'KITCHEN' | 'DELIVERY'; s: StaffInit }) {
  const [att, setAtt] = useState(s.d?.attendance ?? '')
  const [a, setA] = useState(s.d?.startKm != null ? String(s.d.startKm) : '')
  const [b, setB] = useState(s.d?.endKm != null ? String(s.d.endKm) : '')
  const [inT, setInT] = useState(s.d?.inTime ?? (kind === 'DELIVERY' ? DELIVERY_IN : ''))
  const here = att === 'PRESENT'
  const km = a !== '' && b !== '' && Number(b) >= Number(a) ? Number(b) - Number(a) : null
  const off = <td className="td text-muted" colSpan={kind === 'KITCHEN' ? 5 : 9}>{att === 'ABSENT' ? 'Absent today. Nothing else to fill.' : 'Choose Present or Absent first.'}</td>
  return (
    <tr className={att === 'ABSENT' ? 'bg-s2/60' : ''}>
      <td className="td font-semibold whitespace-nowrap"><input type="hidden" name="staff" value={s.id} />{s.name}</td>
      <td className="td"><Attend id={s.id} value={att} onChange={setAtt} /></td>
      {!here ? off : kind === 'KITCHEN' ? (
        <>
          <td className="td"><Three name={`idCard_${s.id}`} value={s.d?.idCard} label="ID card" /></td>
          <td className="td"><Three name={`uniform_${s.id}`} value={s.d?.uniform} label="Uniform" /></td>
          <td className="td"><div className="flex gap-1.5"><Time name={`in_${s.id}`} value={s.d?.inTime} label="Shift 1 in" min={SHIFT1[0]} max={SHIFT1[1]} /><Time name={`out_${s.id}`} value={s.d?.outTime} label="Shift 1 out" min={SHIFT1[0]} max={SHIFT1[1]} /></div></td>
          <td className="td">{!s.shift2 ? <span className="text-xs text-muted">Not on shift 2</span> : <div className="flex gap-1.5"><Time name={`in2_${s.id}`} value={s.d?.inTime2} label="Shift 2 in" min={SHIFT2[0]} max={SHIFT2[1]} /><Time name={`out2_${s.id}`} value={s.d?.outTime2} label="Shift 2 out" min={SHIFT2[0]} max={SHIFT2[1]} /></div>}</td>
          <td className="td"><input name={`remarks_${s.id}`} defaultValue={s.d?.remarks ?? ''} aria-label="Remarks" className={`${cell} min-w-36`} /></td>
        </>
      ) : (
        <>
          <td className="td"><Three name={`idCard_${s.id}`} value={s.d?.idCard} label="ID card" /></td>
          <td className="td"><Three name={`uniform_${s.id}`} value={s.d?.uniform} label="Dress code" /></td>
          <td className="td">
            <select name={`pickup_${s.id}`} required defaultValue={s.d?.onTimePickup == null ? '' : s.d.onTimePickup ? 'yes' : 'no'} aria-label="On-time pick-up" style={{ width: 90, minWidth: 90 }} className={cell}><option value="">Choose</option><option value="yes">Yes</option><option value="no">No</option></select>
          </td>
          <td className="td"><Time name={`in_${s.id}`} value={inT} label="In time" /><div className={`mt-0.5 text-[11px] ${inT > DELIVERY_IN ? 'font-semibold text-red' : 'text-muted'}`}>{inT > DELIVERY_IN ? 'Late, due 5:30' : 'due 5:30'}</div></td>
          <td className="td"><Time name={`out_${s.id}`} value={s.d?.outTime} label="Deliveries complete time" /></td>
          <td className="td"><input type="number" min={0} required name={`startKm_${s.id}`} value={a} onChange={(e) => setA(e.target.value)} aria-label="Starting km" className={`${cell} w-[104px]`} /></td>
          <td className="td"><input type="number" min={0} required name={`endKm_${s.id}`} value={b} onChange={(e) => setB(e.target.value)} aria-label="Ending km" className={`${cell} w-[104px] ${a !== '' && b !== '' && Number(b) < Number(a) ? 'border-red text-red' : ''}`} /></td>
          <td className="td font-semibold whitespace-nowrap">{km != null ? <span className="text-leaf">{km} km</span> : a !== '' && b !== '' ? <span className="text-red">check km</span> : '—'}</td>
          <td className="td"><input name={`remarks_${s.id}`} defaultValue={s.d?.remarks ?? ''} aria-label="Remarks" className={`${cell} min-w-32`} /></td>
        </>
      )}
    </tr>
  )
}

export function StaffTable({ kind, rows }: { kind: 'KITCHEN' | 'DELIVERY'; rows: StaffInit[] }) {
  return (
    <table className="w-full">
      <thead>
        {kind === 'KITCHEN' ? (
          <tr><th className="th">Name</th><th className="th">Present</th><th className="th">ID card</th><th className="th">Uniform</th><th className="th">Shift 1 · in / out<div className="font-normal normal-case">3 AM to 7 AM</div></th><th className="th">Shift 2 · in / out<div className="font-normal normal-case">11 AM to 2 PM, selected staff</div></th><th className="th">Remarks</th></tr>
        ) : (
          <tr><th className="th">Name</th><th className="th">Present</th><th className="th">ID card</th><th className="th">Dress code</th><th className="th">On-time pick-up</th><th className="th">In time</th><th className="th">Deliveries complete</th><th className="th">Starting km</th><th className="th">Ending km</th><th className="th">Total km</th><th className="th">Remarks</th></tr>
        )}
      </thead>
      <tbody>{rows.map((s) => <Row key={s.id} kind={kind} s={s} />)}</tbody>
    </table>
  )
}
