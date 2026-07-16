'use client';

import { useState } from 'react';
import { Calendar, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

const samplePL = {
  revenue: [
    { code: '4100', name: 'Sales Revenue', amount: 125000 },
    { code: '4200', name: 'Service Revenue', amount: 45000 },
  ],
  expenses: [
    { code: '5100', name: 'Cost of Goods Sold', amount: 65000 },
    { code: '5200', name: 'Payroll Expenses', amount: 35000 },
    { code: '5300', name: 'Rent Expense', amount: 24000 },
    { code: '5400', name: 'Utilities Expense', amount: 4800 },
    { code: '5500', name: 'Office Supplies', amount: 2400 },
  ],
  netIncome: 37800,
};

const sampleBS = {
  assets: {
    current: [
      { code: '1110', name: 'Cash', amount: 45000 },
      { code: '1120', name: 'Accounts Receivable', amount: 28000 },
      { code: '1130', name: 'Inventory', amount: 18000 },
    ],
    fixed: [
      { code: '1210', name: 'Equipment', amount: 75000 },
      { code: '1220', name: 'Accumulated Depreciation', amount: -15000 },
    ],
    total: 151000,
  },
  liabilities: {
    current: [
      { code: '2110', name: 'Accounts Payable', amount: 12000 },
      { code: '2120', name: 'Credit Card', amount: 3500 },
    ],
    total: 15500,
  },
  equity: [
    { code: '3100', name: 'Owner\'s Capital', amount: 80000 },
    { code: '3200', name: 'Retained Earnings', amount: 37800 },
    { code: '3300', name: 'Current Year Earnings', amount: 17700 },
  ],
  totalEquity: 135500,
};

const sampleTB = [
  { code: '1110', name: 'Cash', class: 'asset', normal: 'debit', debit: 45000, credit: 0, balance: 45000 },
  { code: '1120', name: 'Accounts Receivable', class: 'asset', normal: 'debit', debit: 28000, credit: 0, balance: 28000 },
  { code: '1130', name: 'Inventory', class: 'asset', normal: 'debit', debit: 18000, credit: 0, balance: 18000 },
  { code: '1210', name: 'Equipment', class: 'asset', normal: 'debit', debit: 75000, credit: 0, balance: 75000 },
  { code: '1220', name: 'Accumulated Depreciation', class: 'asset', normal: 'credit', debit: 0, credit: 15000, balance: -15000 },
  { code: '2110', name: 'Accounts Payable', class: 'liability', normal: 'credit', debit: 0, credit: 12000, balance: -12000 },
  { code: '2120', name: 'Credit Card', class: 'liability', normal: 'credit', debit: 0, credit: 3500, balance: -3500 },
  { code: '3100', name: 'Owner\'s Capital', class: 'equity', normal: 'credit', debit: 0, credit: 80000, balance: -80000 },
  { code: '3200', name: 'Retained Earnings', class: 'equity', normal: 'credit', debit: 0, credit: 37800, balance: -37800 },
  { code: '3300', name: 'Current Year Earnings', class: 'equity', normal: 'credit', debit: 0, credit: 17700, balance: -17700 },
  { code: '4100', name: 'Sales Revenue', class: 'revenue', normal: 'credit', debit: 0, credit: 125000, balance: -125000 },
  { code: '4200', name: 'Service Revenue', class: 'revenue', normal: 'credit', debit: 0, credit: 45000, balance: -45000 },
  { code: '5100', name: 'Cost of Goods Sold', class: 'expense', normal: 'debit', debit: 65000, credit: 0, balance: 65000 },
  { code: '5200', name: 'Payroll Expenses', class: 'expense', normal: 'debit', debit: 35000, credit: 0, balance: 35000 },
  { code: '5300', name: 'Rent Expense', class: 'expense', normal: 'debit', debit: 24000, credit: 0, balance: 24000 },
  { code: '5400', name: 'Utilities Expense', class: 'expense', normal: 'debit', debit: 4800, credit: 0, balance: 4800 },
  { code: '5500', name: 'Office Supplies', class: 'expense', normal: 'debit', debit: 2400, credit: 0, balance: 2400 },
];

const classColors = {
  asset: 'bg-green-50 text-green-700',
  liability: 'bg-red-50 text-red-700',
  equity: 'bg-purple-50 text-purple-700',
  revenue: 'bg-blue-50 text-blue-700',
  expense: 'bg-orange-50 text-orange-700',
};

export default function ReportsPage() {
  const [reportType, setReportType] = useState<'pl' | 'bs' | 'tb'>('pl');
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const [period, setPeriod] = useState(() => ({
    from: firstDayOfMonth,
    to: lastDayOfMonth,
  }));

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const totalDebits = sampleTB.reduce((sum, row) => sum + row.debit, 0);
  const totalCredits = sampleTB.reduce((sum, row) => sum + row.credit, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
            <p className="text-muted-foreground">
              Financial statements and reports
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {(['pl', 'bs', 'tb'] as const).map(type => (
            <Button
              key={type}
              variant={reportType === type ? 'default' : 'outline'}
              onClick={() => setReportType(type)}
            >
              {type === 'pl' ? 'Profit & Loss' : type === 'bs' ? 'Balance Sheet' : 'Trial Balance'}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm text-muted-foreground">
              {formatDate(period.from)} - {formatDate(period.to)}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => {
              const from = new Date(period.from);
              from.setMonth(from.getMonth() - 1);
              const to = new Date(period.to);
              to.setMonth(to.getMonth() - 1);
              setPeriod({ from, to });
            }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const from = new Date(period.from);
              from.setMonth(from.getMonth() + 1);
              const to = new Date(period.to);
              to.setMonth(to.getMonth() + 1);
              setPeriod({ from, to });
            }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {reportType === 'pl' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Profit & Loss</CardTitle>
              <Badge variant="secondary">As of {formatDate(period.to)}</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <section>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </span>
                    Revenue
                  </h3>
                  <div className="space-y-2 ml-4">
                    {samplePL.revenue.map(item => (
                      <div key={item.code} className="flex justify-between py-1 border-b border-muted/50">
                        <span className="text-sm">{item.name}</span>
                        <span className="font-medium text-blue-600">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold">
                      <span>Total Revenue</span>
                      <span className="text-blue-600">{formatCurrency(samplePL.revenue.reduce((s, i) => s + i.amount, 0))}</span>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                      <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </span>
                    Expenses
                  </h3>
                  <div className="space-y-2 ml-4">
                    {samplePL.expenses.map(item => (
                      <div key={item.code} className="flex justify-between py-1 border-b border-muted/50">
                        <span className="text-sm">{item.name}</span>
                        <span className="font-medium text-red-600">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold">
                      <span>Total Expenses</span>
                      <span className="text-red-600">{formatCurrency(samplePL.expenses.reduce((s, i) => s + i.amount, 0))}</span>
                    </div>
                  </div>
                </section>

                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex justify-between items-center py-2 border-t-2 border-primary">
                    <span className="text-lg font-bold">Net Income</span>
                    <span className="text-2xl font-bold text-green-600">
                      {formatCurrency(samplePL.netIncome)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {reportType === 'bs' && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Assets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <section>
                  <h4 className="font-medium mb-3">Current Assets</h4>
                  <div className="space-y-2">
                    {sampleBS.assets.current.map(item => (
                      <div key={item.code} className="flex justify-between py-1 border-b border-muted/50">
                        <span className="text-sm">{item.name}</span>
                        <span className="font-medium">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold border-t">
                      <span>Total Current Assets</span>
                      <span>{formatCurrency(sampleBS.assets.current.reduce((s, i) => s + i.amount, 0))}</span>
                    </div>
                  </div>
                </section>
                <section>
                  <h4 className="font-medium mb-3">Fixed Assets</h4>
                  <div className="space-y-2">
                    {sampleBS.assets.fixed.map(item => (
                      <div key={item.code} className="flex justify-between py-1 border-b border-muted/50">
                        <span className="text-sm">{item.name}</span>
                        <span className="font-medium">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold border-t">
                      <span>Total Fixed Assets</span>
                      <span>{formatCurrency(sampleBS.assets.fixed.reduce((s, i) => s + i.amount, 0))}</span>
                    </div>
                  </div>
                </section>
                <div className="bg-green-50 rounded-lg p-4 border-t-2 border-green-500">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Assets</span>
                    <span className="text-green-700">{formatCurrency(sampleBS.assets.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Liabilities & Equity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <section>
                  <h4 className="font-medium mb-3">Current Liabilities</h4>
                  <div className="space-y-2">
                    {sampleBS.liabilities.current.map(item => (
                      <div key={item.code} className="flex justify-between py-1 border-b border-muted/50">
                        <span className="text-sm">{item.name}</span>
                        <span className="font-medium">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold border-t">
                      <span>Total Current Liabilities</span>
                      <span>{formatCurrency(sampleBS.liabilities.current.reduce((s, i) => s + i.amount, 0))}</span>
                    </div>
                  </div>
                </section>
                <div className="bg-red-50 rounded-lg p-4 border-t-2 border-red-500 mb-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Liabilities</span>
                    <span className="text-red-700">{formatCurrency(sampleBS.liabilities.total)}</span>
                  </div>
                </div>

                <section>
                  <h4 className="font-medium mb-3">Equity</h4>
                  <div className="space-y-2">
                    {sampleBS.equity.map(item => (
                      <div key={item.code} className="flex justify-between py-1 border-b border-muted/50">
                        <span className="text-sm">{item.name}</span>
                        <span className="font-medium">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold border-t">
                      <span>Total Equity</span>
                      <span>{formatCurrency(sampleBS.totalEquity)}</span>
                    </div>
                  </div>
                </section>
                <div className="bg-purple-50 rounded-lg p-4 border-t-2 border-purple-500">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Liabilities & Equity</span>
                    <span className="text-purple-700">{formatCurrency(sampleBS.liabilities.total + sampleBS.totalEquity)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Balanced: ✓</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {reportType === 'tb' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Trial Balance</CardTitle>
              <Badge variant="secondary">Debits = Credits: {totalDebits === totalCredits ? '✓' : '✗'}</Badge>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-muted">
                      <th className="text-left py-2 px-3 font-medium">Code</th>
                      <th className="text-left py-2 px-3 font-medium">Account</th>
                      <th className="text-left py-2 px-3 font-medium">Class</th>
                      <th className="text-right py-2 px-3 font-medium">Debit</th>
                      <th className="text-right py-2 px-3 font-medium">Credit</th>
                      <th className="text-right py-2 px-3 font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampleTB.map(row => (
                      <tr key={row.code} className="border-b border-muted/50">
                        <td className="py-2 px-3 font-mono">{row.code}</td>
                        <td className="py-2 px-3">{row.name}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className={classColors[row.class as keyof typeof classColors]}>
                            {row.class}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{formatCurrency(row.debit)}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatCurrency(row.credit)}</td>
                        <td className="py-2 px-3 text-right font-mono font-medium">
                          {row.balance >= 0 ? 'Dr' : 'Cr'} {formatCurrency(Math.abs(row.balance))}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/50 font-bold border-t-2 border-muted">
                      <td className="py-3 px-3" colSpan={3}>TOTALS</td>
                      <td className="py-3 px-3 text-right font-mono">{formatCurrency(totalDebits)}</td>
                      <td className="py-3 px-3 text-right font-mono">{formatCurrency(totalCredits)}</td>
                      <td className="py-3 px-3 text-right font-mono">{formatCurrency(totalDebits - totalCredits)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
</DashboardLayout>
   );
}