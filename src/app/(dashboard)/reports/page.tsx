'use client';

import { useState } from 'react';
import { Calendar, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

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

  const formatDateISO = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const plQuery = trpc.reports.profitAndLoss.useQuery({
    fromDate: formatDateISO(period.from),
    toDate: formatDateISO(period.to),
  });

  const tbQuery = trpc.reports.trialBalance.useQuery({
    asOfDate: formatDateISO(period.to),
  });

  const bsQuery = trpc.reports.balanceSheet.useQuery({
    asOfDate: formatDateISO(period.to),
  });

  const plData = plQuery.data;
  const tbData = tbQuery.data;
  const bsData = bsQuery.data;

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
          plQuery.isLoading ? (
            <p className="text-center py-8">Loading...</p>
          ) : plData ? (
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
                      {plData.revenueRows.map(item => (
                        <div key={item.accountId} className="flex justify-between py-1 border-b border-muted/50">
                          <span className="text-sm">{item.name}</span>
                          <span className="font-medium text-blue-600">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-2 font-bold">
                        <span>Total Revenue</span>
                        <span className="text-blue-600">{formatCurrency(plData.revenue)}</span>
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
                      {plData.expenseRows.map(item => (
                        <div key={item.accountId} className="flex justify-between py-1 border-b border-muted/50">
                          <span className="text-sm">{item.name}</span>
                          <span className="font-medium text-red-600">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-2 font-bold">
                        <span>Total Expenses</span>
                        <span className="text-red-600">{formatCurrency(plData.expenses)}</span>
                      </div>
                    </div>
                  </section>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex justify-between items-center py-2 border-t-2 border-primary">
                      <span className="text-lg font-bold">Net Income</span>
                      <span className="text-2xl font-bold text-green-600">
                        {formatCurrency(plData.netIncome)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null
        )}

        {reportType === 'bs' && (
          bsQuery.isLoading ? (
            <p className="text-center py-8">Loading...</p>
          ) : bsData ? (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Assets</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    {bsData.assets.current.map(item => (
                      <div key={item.accountId} className="flex justify-between py-1 border-b border-muted/50">
                        <span className="text-sm">{item.name}</span>
                        <span className="font-medium">{formatCurrency(item.balance)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold border-t">
                      <span>Total Assets</span>
                      <span>{formatCurrency(bsData.assets.total)}</span>
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border-t-2 border-green-500">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total Assets</span>
                      <span className="text-green-700">{formatCurrency(bsData.assets.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Liabilities & Equity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    {bsData.liabilities.current.map(item => (
                      <div key={item.accountId} className="flex justify-between py-1 border-b border-muted/50">
                        <span className="text-sm">{item.name}</span>
                        <span className="font-medium">{formatCurrency(item.balance)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold border-t">
                      <span>Total Liabilities</span>
                      <span>{formatCurrency(bsData.liabilities.total)}</span>
                    </div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 border-t-2 border-red-500 mb-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total Liabilities</span>
                      <span className="text-red-700">{formatCurrency(bsData.liabilities.total)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {bsData.equity.accounts.map(item => (
                      <div key={item.accountId} className="flex justify-between py-1 border-b border-muted/50">
                        <span className="text-sm">{item.name}</span>
                        <span className="font-medium">{formatCurrency(item.balance)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold border-t">
                      <span>Total Equity</span>
                      <span>{formatCurrency(bsData.equity.total)}</span>
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 border-t-2 border-purple-500">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total Liabilities & Equity</span>
                      <span className="text-purple-700">{formatCurrency(bsData.totalLiabilitiesAndEquity)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null
        )}

        {reportType === 'tb' && (
          tbQuery.isLoading ? (
            <p className="text-center py-8">Loading...</p>
          ) : tbData ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Trial Balance</CardTitle>
                <Badge variant="secondary">Balanced: {tbData.totals.isBalanced ? '✓' : '✗'}</Badge>
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
                      {tbData.rows.map(row => (
                        <tr key={row.accountId} className="border-b border-muted/50">
                          <td className="py-2 px-3 font-mono">{row.code}</td>
                          <td className="py-2 px-3">{row.name}</td>
                          <td className="py-2 px-3">
                            <Badge variant="outline" className={classColors[row.accountClass as keyof typeof classColors]}>
                              {row.accountClass}
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
                        <td className="py-3 px-3 text-right font-mono">{formatCurrency(tbData.totals.totalDebits)}</td>
                        <td className="py-3 px-3 text-right font-mono">{formatCurrency(tbData.totals.totalCredits)}</td>
                        <td className="py-3 px-3 text-right font-mono">{formatCurrency(tbData.totals.totalBalance)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null
        )}
      </div>
    </DashboardLayout>
  );
}