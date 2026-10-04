'use client'

import { useState } from 'react'

export function StatusFields({ options, value, start, end, packageTypes, slots }: { options: [string, string][]; value: string; start: string; end: string; packageTypes: string[]; slots: string[] }) {
  const [status, setStatus] = useState(value)
  const trial = status === 'TRIAL_REQUESTED' && value !== 'TRIAL_REQUESTED'
  const monthly = status === 'CONVERTED' && value !== 'CONVERTED'
  return (
    <>
      <div>
        <label className="label" htmlFor="status">Status</label>
        <select id="status" name="status" className={`input ${trial || monthly ? 'border-tur' : ''}`} value={status} onChange={(e) => setStatus(e.target.value)}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {trial && (
        <>
          <div className="rounded-[10px] bg-tur-soft px-3.5 py-3">
            <div className="text-xs font-bold text-warn">Automatic when you save</div>
            <p className="mt-1 text-[13px] leading-[18px]">A trial order is created, assigned to the kitchen manager and the kitchen is notified. No WhatsApp needed.</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div><label className="label" htmlFor="trialStart">Trial start</label><input id="trialStart" name="trialStart" type="date" className="input" defaultValue={start} /></div>
            <div><label className="label" htmlFor="trialEnd">Trial end</label><input id="trialEnd" name="trialEnd" type="date" className="input" defaultValue={end} /></div>
          </div>
        </>
      )}
      {monthly && (
        <>
          <div className="rounded-[10px] bg-leaf-soft px-3.5 py-3">
            <div className="text-xs font-bold text-leaf">Automatic when you save</div>
            <p className="mt-1 text-[13px] leading-[18px]">A monthly package (regular box) is created and this person moves to Customers.</p>
          </div>
          <div><label className="label" htmlFor="packageType">Package type</label><select id="packageType" name="packageType" className="input">{packageTypes.map((p) => <option key={p}>{p}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-2.5">
            <div><label className="label" htmlFor="startDate">Start date</label><input id="startDate" name="startDate" type="date" className="input" defaultValue={start} /></div>
            <div><label className="label" htmlFor="slot">Delivery slot</label><select id="slot" name="slot" className="input">{slots.map((p) => <option key={p}>{p}</option>)}</select></div>
          </div>
        </>
      )}
    </>
  )
}
