import { Suspense } from 'react'
import { Clock } from '@/components/Clock'
import { TableTools } from '@/components/TableTools'
import { Sidebar, type NavItem } from '@/components/Sidebar'
import { requireUser } from '@/lib/auth'
import { navBadges, type Badges } from '@/lib/badges'
import { ROLE } from '@/lib/labels'
import { logout } from '@/app/login/actions'

// Menus follow the Figma V2 sidebars. Each person sees only their own work; admin sees everything.
const SALES: NavItem[] = [
  { href: '/leads', label: 'Leads', icon: 'leads' },
  { href: '/invite', label: 'Customer form link', icon: 'link' },
  { href: '/calls', label: 'Call register', icon: 'phone' },
  { href: '/trials', label: 'Trials', icon: 'box' },
  { href: '/customers', label: 'Customers', icon: 'customers' },
  { href: '/menu', label: 'Daily menu', icon: 'menu' },
  { href: '/attendance', label: 'Delivery attendance', icon: 'attendance' },
  { href: '/reminders', label: 'Reminders', icon: 'bell' },
  { href: '/renewals', label: 'Renewals', icon: 'calendar' },
  { href: '/issues', label: 'Daily issues', icon: 'alert' },
  { href: '/reports', label: 'Monthly reports', icon: 'report' },
]
const KITCHEN: NavItem[] = [
  { href: '/kitchen/boxes', label: "Today's boxes", icon: 'box' },
  { href: '/menu', label: 'Daily menu', icon: 'menu' },
  { href: '/kitchen/sheet', label: 'Delivery attendance', icon: 'attendance' },
  { href: '/kitchen/customers', label: 'Customers', icon: 'customers' },
  { href: '/invite', label: 'Customer form link', icon: 'link' },
  { href: '/kitchen/calls', label: 'Customer calls', icon: 'phone' },
  { href: '/renewals', label: 'Renewals', icon: 'calendar' },
  { href: '/kitchen/alt-boxes', label: 'Alternative boxes', icon: 'box' },
  { href: '/kitchen/stock', label: 'Stock', icon: 'stock' },
  { href: '/kitchen/wastage', label: 'Wastage', icon: 'trash' },
  { href: '/kitchen/staff', label: 'Staff tracking', icon: 'idcard' },
]
const REPORTS: NavItem = { href: '/reports', label: 'Monthly reports', icon: 'report' }
const ALL_REPORTS: NavItem = { href: '/report', label: 'All reports', icon: 'chart' }

const NAV: Record<string, NavItem[]> = {
  SALES: [{ href: '/dashboard', label: 'Dashboard', icon: 'dashboard' }, { href: '/calendar', label: 'Calendar', icon: 'calendar' }, ...SALES, ALL_REPORTS],
  KITCHEN: [{ href: '/kitchen', label: 'Dashboard', icon: 'dashboard' }, { href: '/calendar', label: 'Calendar', icon: 'calendar' }, ...KITCHEN, REPORTS, ALL_REPORTS],
  ADMIN: [
    { href: '/admin', label: 'Overview', icon: 'chart' },
    { href: '/calendar', label: 'Calendar', icon: 'calendar' },
    ...SALES.map((x) => ({ ...x, group: 'Sales' })),
    ...KITCHEN.filter((x) => x.href !== '/kitchen/customers' && x.href !== '/menu' && x.href !== '/invite' && x.href !== '/renewals').map((x) => ({ ...x, group: 'Kitchen' })),
    { href: '/admin/reports', label: 'Reports', icon: 'chart', group: 'Business' },
    { ...ALL_REPORTS, group: 'Business' },
    { href: '/admin/money', label: 'Purchase + expenses', icon: 'money', group: 'Business' },
    { href: '/admin/dues', label: 'Dues', icon: 'wallet', group: 'Business' },
    { href: '/admin/requests', label: 'Past-day requests', icon: 'bell', group: 'Business' },
    { href: '/admin/notices', label: 'Deleted by team', icon: 'alert', group: 'Business' },
    { href: '/admin/users', label: 'Team + regions', icon: 'team', group: 'Business' },
    { href: '/admin/backups', label: 'Backups', icon: 'stock', group: 'Business' },
    { href: '/admin/settings', label: 'Settings', icon: 'settings', group: 'Business' },
  ],
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const section = user.role === 'KITCHEN' ? 'Kitchen' : user.role === 'SALES' ? 'Sales' : 'Admin'
  // Counts are a help, never a reason for a page to fail.
  const badges: Badges = await navBadges(user.role).catch(() => ({}))
  return (
    <div className="md:flex">
      <Sidebar section={section} items={NAV[user.role]} badges={badges} user={{ name: user.name, role: ROLE[user.role][0] }} logout={logout} />
      <main className="min-w-0 flex-1 space-y-[18px] px-4 py-6 md:px-8 md:py-7">{children}</main>
      <Suspense fallback={null}><TableTools /></Suspense>
    </div>
  )
}
