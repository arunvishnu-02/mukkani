import { currentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { addDays, day, keyOf } from '@/lib/dates'
import { LEAD_IMPORT_COLUMNS } from '@/lib/csv'
import { appSettings } from '@/lib/settings'

// The sample file for Leads > Import: the column headings and three example rows, using this business's own regions and slots.
export async function GET() {
  if (!(await currentUser())) return new Response('Not logged in', { status: 401 })
  const [regions, st] = await Promise.all([db.region.findMany({ orderBy: { name: 'asc' } }), appSettings()])
  const region = (i: number) => regions[i % Math.max(regions.length, 1)]?.name ?? ''
  const slot = (i: number) => st.slots[i % Math.max(st.slots.length, 1)] ?? ''
  const next = keyOf(addDays(day(0), 1))
  const rows = [
    [...LEAD_IMPORT_COLUMNS],
    ['Kavya Tamil', '98430 11223', '', 'Instagram DM', region(0), '12, North Chitra St', '1992-03-14', slot(0), 'Papaya, pineapple', 'Sugar patient', 'Asked about the monthly pack', next],
    ['Harini S', '94432 55871', '90034 77120', 'WhatsApp', region(1), '', '', slot(1), '', '', 'Wants a trial box first', next],
    ['Rishi K', '90034 77120', '', 'Google Business', region(2), '4, Main Road', '15/08/1988', '', 'Banana', '', '', ''],
  ]
  const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n') + '\r\n'
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="mukkani-leads-sample.csv"', 'Cache-Control': 'no-store' },
  })
}
