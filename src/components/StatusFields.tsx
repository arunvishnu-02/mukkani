'use client'

import { useState } from 'react'

export function StatusFields({ options, value, start, end }: { options: [string, string][]; value: string; start: string; end: string }) {
  const [status, setStatus] = useState(value)
  const trial = status === 'TRIAL_REQUESTED' && value !== 'TRIAL_REQUESTED'
  return (
    <>
      <div>
        <label className="label" htmlFor="status">Status</label>
        <select id="status" name="status" className={`input ${trial ? 'border-tur' : ''}`} value={status} onChange={(e) => setStatus(e.target.value)}>
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
    </>
  )
}
