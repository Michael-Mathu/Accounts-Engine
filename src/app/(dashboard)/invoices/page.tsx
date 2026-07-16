'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

const statusConfig = {
  all: { label: 'All', variant: 'secondary' as const, className: '' },
  draft: { label: 'Draft', variant: 'secondary' as const, className: '' },
  sent: { label: 'Sent', variant: 'default' as const, className: '' },
  partial: { label: 'Partial', variant: 'outline' as const, className: '' },
  paid: { label: 'Paid', variant: 'default' as const, className: 'bg-green-100 text-green-700' },
  void: { label: 'Void', variant: 'destructive' as const, className: '' },
};

export default function InvoicesPage() {
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'sent' | 'partial' | 'paid' | 'void'>('all');

  const { data, isLoading, error } = trpc.invoices.list.useQuery({
    status: filterStatus === 'all' ? undefined : filterStatus,
  });

  const invoices = data?.invoices || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
            <p className="text-muted-foreground">Manage customer invoices</p>
          </div>
          <Button asChild>
            <Link href="/dashboard/invoices/new">New Invoice</Link>
          </Button>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Failed to load invoices: {error.message}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>All Invoices</CardTitle>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'draft' | 'sent' | 'partial' | 'paid' | 'void')}
              className="border rounded px-3 py-2 text-sm bg-background"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading invoices...</p>
                </div>
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No invoices found.</p>
                <Button asChild variant="link" className="mt-2">
                  <Link href="/dashboard/invoices/new">Create your first invoice</Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <div className="grid grid-cols-[100px_1fr_120px_120px_100px_120px_100px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                  <div>Number</div>
                  <div>Customer</div>
                  <div>Issue Date</div>
                  <div>Due Date</div>
                  <div>Status</div>
                  <div className="text-right">Total</div>
                  <div className="text-right">Actions</div>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  {invoices.map(inv => (
                    <div key={inv.id} className="grid grid-cols-[100px_1fr_120px_120px_100px_120px_100px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                      <div className="font-mono font-medium">{inv.invoiceNumber}</div>
                      <div className="font-medium">{inv.customerName}</div>
                      <div className="text-sm text-muted-foreground">{formatDate(inv.issueDate)}</div>
                      <div className="text-sm text-muted-foreground">{formatDate(inv.dueDate)}</div>
                      <div>
                        <Badge variant={statusConfig[inv.status].variant} className={statusConfig[inv.status].className}>
                          {statusConfig[inv.status].label}
                        </Badge>
                      </div>
                      <div className="text-right font-medium">{formatCurrency(Number(inv.total))}</div>
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon" asChild title="View">
                          <Link href={`/dashboard/invoices/${inv.id}`}>
                            <Plus className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}