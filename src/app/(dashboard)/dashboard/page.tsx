'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Truck, 
  FileText, 
  FileCheck, 
  CreditCard, 
  Banknote, 
  Receipt, 
  Calculator,
  TrendingUp,
  DollarSign
} from 'lucide-react';

const stats = [
  { 
    name: 'Total Revenue', 
    value: '$0.00', 
    icon: DollarSign, 
    color: 'text-green-600',
    change: '+0%',
  },
  { 
    name: 'Total Expenses', 
    value: '$0.00', 
    icon: TrendingUp, 
    color: 'text-red-600',
    change: '0%',
  },
  { 
    name: 'Open Invoices', 
    value: '0', 
    icon: FileText, 
    color: 'text-blue-600',
    change: '0',
  },
  { 
    name: 'Open Bills', 
    value: '0', 
    icon: FileCheck, 
    color: 'text-orange-600',
    change: '0',
  },
];

const quickActions = [
  { name: 'New Journal Entry', href: '/dashboard/journal-entries/new', icon: FileText, description: 'Record a transaction' },
  { name: 'Create Invoice', href: '/dashboard/invoices/new', icon: FileText, description: 'Bill a customer' },
  { name: 'Record Bill', href: '/dashboard/bills/new', icon: FileCheck, description: 'Record a vendor bill' },
  { name: 'Record Payment', href: '/dashboard/payments/new', icon: CreditCard, description: 'Apply payment to invoice/bill' },
  { name: 'Import Bank Transactions', href: '/dashboard/banking/import', icon: Banknote, description: 'Import CSV/OFX' },
  { name: 'Upload Receipt', href: '/dashboard/receipts/upload', icon: Receipt, description: 'OCR extraction' },
];

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back! Here&apos;s an overview of your financials.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <a href="/dashboard/journal-entries/new">New Journal Entry</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/dashboard/invoices/new">Create Invoice</a>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.name}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.change} from last period</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => (
              <a key={action.name} href={action.href} className="block">
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-lg text-primary">
                        <action.icon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-medium">{action.name}</p>
                        <p className="text-sm text-muted-foreground">{action.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </div>

        {/* Recent Activity Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest transactions and activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent activity yet. Start by creating your first journal entry or invoice.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}