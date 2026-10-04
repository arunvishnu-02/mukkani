import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { CUSTOMER_COLUMNS, toCsv } from '@/lib/csv'
import { dayInput, todayKey } from '@/lib/dates'
import { PACKAGE_STATUS, PACKAGE_TYPES, SLOTS } from '@/lib/labels'
import { customerWhere, leadInclude } from '@/lib/queries'

// /customers/export downloads every customer as CSV. /customers/export?sample=1 downloads the sample file for import.
export async function GET(request: Request) {
  await requireUser(['SALES'])
  const sample = new URL(request.url).searchParams.has('sample')
  const rows = sample
    ? [
        ['Meena R', '9843122017', 'Srirangam', '12, 2nd Cross, Srirangam, Trichy', 'Diabetes', 'Calls after 6 pm only', PACKAGE_TYPES[1], SLOTS[0], todayKey(), 'Active'],
        ['Karthik S', '9003155120', 'Thillai Nagar', '', '', '', PACKAGE_TYPES[2], SLOTS[2], todayKey(), 'Active'],
        ['Revathi M', '9789044211', 'K.K. Nagar', '5, 4th Cross, K.K. Nagar, Trichy', 'BP, less salt', 'Out of town till month end', PACKAGE_TYPES[0], SLOTS[1], todayKey(-30), 'Paused'],
      ]
    : (await db.lead.findMany({ where: customerWhere, include: leadInclude, orderBy: { name: 'asc' } })).map((l) => {
        const p = l.packages[0]
        return [l.name, l.phone, l.region?.name, l.address, l.foodNotes, l.notes, p?.packageType, l.slot, dayInput(p?.startDate), p ? PACKAGE_STATUS[p.status][0] : '']
      })
  return new Response(toCsv([CUSTOMER_COLUMNS, ...rows]), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${sample ? 'mukkani-customers-sample' : `mukkani-customers-${todayKey()}`}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
