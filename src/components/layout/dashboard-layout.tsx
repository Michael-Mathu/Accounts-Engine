import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  FileText, 
  BarChart3, 
  Users, 
  Truck, 
  FileCheck, 
  CreditCard, 
  Banknote, 
  Receipt, 
  Calculator, 
  Settings,
  Building2,
  ListTree
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Chart of Accounts', href: '/dashboard/chart-of-accounts', icon: ListTree },
  { name: 'Journal Entries', href: '/dashboard/journal-entries', icon: FileText },
  { name: 'Reports', href: '/dashboard/reports', icon: BarChart3, children: [
    { name: 'Trial Balance', href: '/dashboard/reports/trial-balance' },
    { name: 'Profit & Loss', href: '/dashboard/reports/profit-loss' },
    { name: 'Balance Sheet', href: '/dashboard/reports/balance-sheet' },
  ]},
  { name: 'Customers', href: '/dashboard/customers', icon: Users },
  { name: 'Vendors', href: '/dashboard/vendors', icon: Truck },
  { name: 'Invoices', href: '/dashboard/invoices', icon: FileText },
  { name: 'Bills', href: '/dashboard/bills', icon: FileCheck },
  { name: 'Payments', href: '/dashboard/payments', icon: CreditCard },
  { name: 'Banking', href: '/dashboard/banking', icon: Banknote },
  { name: 'Receipts', href: '/dashboard/receipts', icon: Receipt },
  { name: 'Tax', href: '/dashboard/tax', icon: Calculator },
  { name: 'Billing', href: '/dashboard/billing', icon: Settings },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60 hidden lg:flex flex-col">
        <div className="flex h-16 shrink-0 items-center px-6 border-b">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Accounting Engine</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-4 overflow-y-auto" aria-label="Main navigation">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.children && item.children.some(child => pathname === child.href));
            const isParentActive = item.children && item.children.some(child => pathname === child.href);
            
            if (item.children) {
              return (
                <details 
                  key={item.name}
                  className="group"
                  open={isParentActive}
                >
                  <summary className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer',
                    isParentActive 
                      ? 'text-primary bg-primary/10' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}>
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1">{item.name}</span>
                    <span className="text-xs opacity-50 group-open:rotate-90 transition-transform">▶</span>
                  </summary>
                  <ul className="mt-1 ml-6 space-y-1 border-l pl-3">
                    {item.children.map((child) => (
                      <li key={child.name}>
                        <Link
                          href={child.href}
                          className={cn(
                            'block px-2 py-1.5 text-sm rounded-md transition-colors',
                            pathname === child.href
                              ? 'text-primary bg-primary/10 font-medium'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                          )}
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            }
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          <Link
            href="/dashboard/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname === '/dashboard/settings'
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            <Settings className="h-5 w-5 shrink-0" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 min-h-screen">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}