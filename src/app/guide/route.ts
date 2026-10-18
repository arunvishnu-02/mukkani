import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { GUIDE_HTML } from './html'

// The team guide: one plain page for every role, for logged-in staff only.
export async function GET() {
  if (!(await currentUser())) redirect('/login')
  return new Response(GUIDE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } })
}
