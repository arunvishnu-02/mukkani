'use client'

import { useEffect, useState } from 'react'

// The bill photo field with a small preview: the saved bill, or the file just picked.
export function BillPhoto({ saved }: { saved?: { id: string; isImage: boolean } | null }) {
  const [picked, setPicked] = useState<{ url: string; isImage: boolean; name: string } | null>(null)
  useEffect(() => () => { if (picked) URL.revokeObjectURL(picked.url) }, [picked])
  const show = picked ?? (saved ? { url: `/api/files/${saved.id}`, isImage: saved.isImage, name: 'Saved bill' } : null)
  return (
    <div>
      <label className="label" htmlFor="bill">Bill photo{saved ? ' (pick a new one to replace)' : ''}</label>
      <div className="flex items-start gap-3">
        {show && (
          <a href={show.url} target="_blank" rel="noreferrer" title="Open full size" className="flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-s2 text-xs font-bold text-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {show.isImage ? <img src={show.url} alt={show.name} className="size-full object-cover" /> : 'PDF'}
          </a>
        )}
        <div className="min-w-0 flex-1">
          <input
            id="bill"
            name="bill"
            type="file"
            accept="image/*,application/pdf"
            className="input py-2"
            onChange={(e) => {
              const f = e.target.files?.[0]
              setPicked(f ? { url: URL.createObjectURL(f), isImage: f.type.startsWith('image/'), name: f.name } : null)
            }}
          />
          <p className="mt-1 text-xs text-muted">
            {picked ? 'New photo, saved when you press Save.' : saved ? 'Tap the preview to open the saved bill.' : 'JPG, PNG or PDF up to 5 MB.'}
          </p>
        </div>
      </div>
    </div>
  )
}
