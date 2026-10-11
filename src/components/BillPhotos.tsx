'use client'

import { useEffect, useState } from 'react'

type Shown = { url: string; isImage: boolean; name: string }

function Thumb({ file }: { file: Shown }) {
  return (
    <a href={file.url} target="_blank" rel="noreferrer" title="Open full size" className="flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-s2 text-xs font-bold text-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {file.isImage ? <img src={file.url} alt={file.name} className="size-full object-cover" /> : 'PDF'}
    </a>
  )
}

// The bill photos field: small previews of the saved photos (each can be removed) and of the files just picked.
export function BillPhotos({ saved, max }: { saved: { id: string; isImage: boolean }[]; max: number }) {
  const [picked, setPicked] = useState<Shown[]>([])
  useEffect(() => () => picked.forEach((p) => URL.revokeObjectURL(p.url)), [picked])
  return (
    <div>
      <label className="label" htmlFor="bill">Bill photos</label>
      {saved.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2.5">
          {saved.map((s, i) => (
            <div key={s.id} className="w-[72px]">
              <Thumb file={{ url: `/api/files/${s.id}`, isImage: s.isImage, name: `Saved bill ${i + 1}` }} />
              <label className="mt-1 flex items-center gap-1 text-[11px] font-medium text-muted"><input type="checkbox" name="removeBill" value={s.id} className="size-3.5 accent-red" /> Remove</label>
            </div>
          ))}
        </div>
      )}
      <input
        id="bill"
        name="bill"
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="input py-2"
        onChange={(e) => setPicked([...(e.target.files ?? [])].map((f) => ({ url: URL.createObjectURL(f), isImage: f.type.startsWith('image/'), name: f.name })))}
      />
      {picked.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2.5">
          {picked.map((p) => <Thumb key={p.url} file={p} />)}
        </div>
      )}
      <p className="mt-1 text-xs text-muted">
        {picked.length > 0 ? `${picked.length} new, added when you press Save.` : `Pick one or several. JPG, PNG or PDF, up to 5 MB each, ${max} per entry.`}
      </p>
    </div>
  )
}
