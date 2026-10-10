'use client'

import { useEffect, useState } from 'react'

// Bulk select on list screens: row checkboxes belong to the form by id, the bar appears once one is ticked.
export function BulkBar({ formId, action, label = 'Delete', confirmText }: { formId: string; action: (f: FormData) => Promise<void>; label?: string; confirmText: string }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const read = () => setCount(document.querySelectorAll(`input[form="${formId}"][name="ids"]:checked`).length)
    document.addEventListener('change', read)
    return () => document.removeEventListener('change', read)
  }, [formId])
  return (
    <form
      id={formId}
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText.replace('{n}', String(count)))) e.preventDefault()
      }}
      className={count ? 'sticky bottom-4 z-20 flex items-center gap-3 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-lg' : 'hidden'}
    >
      <span className="flex-1">{count} selected</span>
      <button className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-red">{label}</button>
    </form>
  )
}

export function SelectAll({ formId }: { formId: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Select all"
      className="size-4 accent-brand"
      onChange={(e) => {
        document.querySelectorAll<HTMLInputElement>(`input[form="${formId}"][name="ids"]`).forEach((x) => (x.checked = e.target.checked))
        document.dispatchEvent(new Event('change'))
      }}
    />
  )
}

export function RowCheck({ formId, id }: { formId: string; id: string }) {
  return <input type="checkbox" name="ids" value={id} form={formId} aria-label="Select" className="size-4 accent-brand" />
}
