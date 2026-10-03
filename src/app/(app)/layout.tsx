import { Sidebar, type NavItem } from '@/components/Sidebar'
import { requireUser } from '@/lib/auth'
import { ROLE } from '@/lib/labels'
import { logout } from '@/app/login/actions'

const SALES: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leads', label: 'Leads' },
  { href: '/follow-ups', label: 'Follow-ups' },
  { href: '/customers', label: 'Customers' },
  { href: '/boxes', label: 'Trial / Regular boxes' },
]
const KITCHEN: NavItem[] = [
  { href: '/kitchen', label: 'Dashboard' },
  { href: '/kitchen/boxes', label: 'Boxes' },
  { href: '/kitchen/monthly', label: 'Monthly customers' },
]
const ADMIN: NavItem[] = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users + regions' },
  ...SALES,
  { href: '/kitchen', label: 'Kitchen view' },
]

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const items = user.role === 'ADMIN' ? ADMIN : user.role === 'SALES' ? SALES : KITCHEN
  const section = user.role === 'KITCHEN' ? 'Kitchen' : user.role === 'SALES' ? 'Sales' : 'Admin'
  return (
    <div className="md:flex">
      <Sidebar section={section} items={items} user={{ name: user.name, role: ROLE[user.role][0] }} logout={logout} />
      <main className="min-w-0 flex-1 space-y-[18px] px-4 py-6 md:px-8 md:py-7">{children}</main>
    </div>
  )
}
