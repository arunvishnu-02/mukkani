import { Sidebar, type NavItem } from '@/components/Sidebar'
import { requireUser } from '@/lib/auth'
import { ROLE } from '@/lib/labels'
import { logout } from '@/app/login/actions'

const SALES: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/leads', label: 'Leads', icon: 'leads' },
  { href: '/follow-ups', label: 'Follow-ups', icon: 'phone' },
  { href: '/customers', label: 'Customers', icon: 'customers' },
  { href: '/boxes', label: 'Trial / Regular boxes', icon: 'box' },
]
const KITCHEN: NavItem[] = [
  { href: '/kitchen', label: 'Dashboard', icon: 'dashboard' },
  { href: '/kitchen/boxes', label: 'Boxes', icon: 'box' },
  { href: '/kitchen/monthly', label: 'Monthly customers', icon: 'calendar' },
]
const ADMIN: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: 'chart' },
  { href: '/admin/users', label: 'Users + regions', icon: 'settings' },
  ...SALES,
  { href: '/kitchen', label: 'Kitchen view', icon: 'kitchen' },
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
