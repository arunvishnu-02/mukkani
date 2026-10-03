import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { ShareButton } from './ShareButton'

export const metadata: Metadata = { title: 'Share your delivery location · Mukkani', robots: { index: false } }

export default async function CustomerLocationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const req = await db.locationRequest.findUnique({ where: { token }, include: { lead: { select: { name: true } } } })
  const valid = req && req.expiresAt > new Date()
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col gap-4 bg-surface px-5 py-8">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-tur px-1.5 py-0.5 text-xs font-bold text-side">M</span>
        <span className="font-bold">Mukkani</span>
      </div>
      {!valid ? (
        <p className="text-sm text-muted">This link has expired. Please ask Mukkani for a new one.</p>
      ) : (
        <>
          <h1 className="font-display text-3xl font-bold">Hi {req.lead.name.split(' ')[0]}</h1>
          <p className="text-sm leading-relaxed text-muted">
            Share your exact location so your Mukkani box reaches the right door every morning.
          </p>
          {req.sharedAt && <p className="rounded-lg bg-leaf-soft px-3 py-2 text-sm text-leaf">Already shared. Tap again if you moved.</p>}
          <ShareButton token={token} />
        </>
      )}
    </div>
  )
}
