import Image from 'next/image'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { day, longToday } from '@/lib/dates'
import { deliveryRegions, ensureRound, mapsKeys, todayStops } from '@/lib/delivery'
import { logout } from '@/app/login/actions'
import { DeliveryApp } from './DeliveryApp'

export const metadata = { title: 'Today · Mukkani delivery' }

// The delivery person's phone screen: today's drops in their region, the route, and 2-tap marking.
export default async function DeliveryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser(['DELIVERY'])
  const sp = await searchParams
  const regions = await deliveryRegions(user)
  const isAdmin = user.role === 'ADMIN'
  // Admin looks at one region at a time; a delivery person sees all of their own regions together.
  const region = isAdmin ? (regions.find((r) => r.id === sp.region) ?? regions[0]) : null
  const ids = region ? [region.id] : regions.map((r) => r.id)
  const { stops, leave } = await todayStops(ids)
  // The first open of the day is the start time.
  const round = isAdmin ? null : await ensureRound(user.id, stops.length)
  const centre = regions.find((r) => ids.includes(r.id) && r.lat != null && r.lng != null)
  const first = user.name.split(' ')[0]
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col bg-bg">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/95 px-4 pt-[max(env(safe-area-inset-top),10px)] pb-2.5 backdrop-blur">
        <Image src="/mukkani-mark.png" alt="Mukkani" width={34} height={34} priority className="rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold leading-5">Hi {first}</div>
          <div className="truncate text-[13px] text-muted">
            {longToday()} · {regions.filter((r) => ids.includes(r.id)).map((r) => r.name).join(', ') || 'No region'}
          </div>
        </div>
        {isAdmin ? (
          <Link href="/admin/delivery" className="btn-secondary btn-sm min-h-11">Back</Link>
        ) : (
          <form action={logout}>
            <button className="min-h-11 rounded-lg px-3 text-[13px] font-semibold text-muted active:bg-s2">Log out</button>
          </form>
        )}
      </header>
      {isAdmin && regions.length > 1 && (
        <nav className="flex gap-2 overflow-x-auto px-4 pt-3" aria-label="Regions">
          {regions.map((r) => (
            <Link key={r.id} href={`/delivery?region=${r.id}`} className={`min-h-10 shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold ${r.id === region?.id ? 'bg-brand text-white' : 'border border-line bg-surface'}`}>
              {r.name}{r.deliveryUser ? ` · ${r.deliveryUser.name.split(' ')[0]}` : ''}
            </Link>
          ))}
        </nav>
      )}
      {regions.length === 0 ? (
        <div className="m-4 rounded-xl border border-line bg-surface p-6 text-center">
          <h1 className="font-display text-xl font-semibold">No region yet</h1>
          <p className="mt-2 text-sm text-muted">Ask the admin to assign you a region in Team + regions. Your drops will show here.</p>
        </div>
      ) : (
        <DeliveryApp
          key={region?.id ?? 'mine'}
          stops={stops}
          leave={leave}
          mapKey={mapsKeys().browser}
          centre={centre ? { lat: centre.lat!, lng: centre.lng! } : null}
          regionId={region?.id ?? null}
          tracking={!isAdmin}
          round={round ? { loginAt: round.loginAt.toISOString(), finishedAt: round.finishedAt?.toISOString() ?? null } : null}
          today={day(0).toISOString().slice(0, 10)}
        />
      )}
    </div>
  )
}
