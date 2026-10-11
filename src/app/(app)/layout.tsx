import { Sidebar, type NavItem } from '@/components/Sidebar'
import { requireUser } from '@/lib/auth'
import { ROLE } from '@/lib/labels'
import { logout } from '@/app/login/actions'

// Menus follow the Figma V2 sidebars. Each person sees only their own work; admin sees everything.
const SALES: NavItem[] = [
  { href: '/leads', label: 'Leads', icon: 'leads' },
  { href: '/calls', label: 'Call register', icon: 'phone' },
  { href: '/trials', label: 'Trials', icon: 'box' },
  { href: '/customers', label: 'Customers', icon: 'customers' },
  { href: '/menu', label: 'Daily menu', icon: 'menu' },
  { href: '/attendance', label: 'Delivery attendance', icon: 'attendance' },
  { href: '/reminders', label: 'Reminders', icon: 'bell' },
]
const KITCHEN: NavItem[] = [
  { href: '/kitchen/boxes', label: "Today's boxes", icon: 'box' },
  { href: '/kitchen/sheet', label: 'Delivery attendance', icon: 'attendance' },
  { href: '/kitchen/customers', label: 'Customers', icon: 'customers' },
  { href: '/kitchen/calls', label: 'Customer calls', icon: 'phone' },
  { href: '/kitchen/alt-boxes', label: 'Alternative boxes', icon: 'box' },
  { href: '/kitchen/stock', label: 'Stock', icon: 'stock' },
  { href: '/kitchen/wastage', label: 'Wastage', icon: 'trash' },
]
const REPORTS: NavItem = { href: '/reports', label: 'Monthly reports', icon: 'report' }

const NAV: Record<string, NavItem[]> = {
  SALES: [{ href: '/dashboard', label: 'Dashboard', icon: 'dashboard' }, { href: '/calendar', label: 'Calendar', icon: 'calendar' }, ...SALES, REPORTS],
  KITCHEN: [{ href: '/kitchen', label: 'Dashboard', icon: 'dashboard' }, { href: '/calendar', label: 'Calendar', icon: 'calendar' }, ...KITCHEN, REPORTS],
  ADMIN: [
    { href: '/admin', label: 'Overview', icon: 'chart' },
    { href: '/calendar', label: 'Calendar', icon: 'calendar' },
    ...SALES.map((x) => ({ ...x, group: 'Sales' })),
    ...[...KITCHEN.filter((x) => x.href !== '/kitchen/customers'), REPORTS].map((x) => ({ ...x, group: 'Kitchen' })),
    { href: '/admin/reports', label: 'Reports', icon: 'chart', group: 'Business' },
    { href: '/admin/money', label: 'Purchase + expenses', icon: 'money', group: 'Business' },
    { href: '/admin/users', label: 'Team + regions', icon: 'team', group: 'Business' },
    { href: '/admin/settings', label: 'Settings', icon: 'settings', group: 'Business' },
  ],
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const section = user.role === 'KITCHEN' ? 'Kitchen' : user.role === 'SALES' ? 'Sales' : 'Admin'
  return (
    <div className="md:flex">
      <Sidebar section={section} items={NAV[user.role]} user={{ name: user.name, role: ROLE[user.role][0] }} logout={logout} />
      <main className="min-w-0 flex-1 space-y-[18px] px-4 py-6 md:px-8 md:py-7">{children}</main>
    </div>
  )
}
