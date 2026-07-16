'use client';

import { useState } from 'react';
import { Plus, Search, ChevronDown, ChevronRight, Eye, Edit, Archive, Download, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

const statusConfig = {
  draft: { label: 'Draft', variant: 'secondary' as const, className: '' },
  approved: { label: 'Approved', variant: 'default' as const, className: '' },
  partial: { label: 'Partial', variant: 'outline' as const, className: '' },
  paid: { label: 'Paid', variant: 'default' as const, className: 'bg-green-100 text-green-700' },
  void: { label: 'Void', variant: 'destructive' as const, className: '' },
};

export default function BillsPage() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'approved' | 'partial' | 'paid' | 'void'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const billsQuery = trpc.bills.list.useQuery(
    { page, pageSize, status: filterStatus === 'all' ? undefined : filterStatus },
    { enabled: true }
  );

  const bills = billsQuery.data?.bills || [];
  const pagination = billsQuery.data?.pagination;
  const isLoading = billsQuery.isLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bills</h1>
            <p className="text-muted-foreground">Manage vendor bills</p>
          </div>
          <Button asChild>
            <a href="/dashboard/bills/new">New Bill</a>
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>All Bills</CardTitle>
            <div className="flex items-center gap-4">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as 'all' | 'draft' | 'approved' | 'partial' | 'paid' | 'void')}
                className="border rounded px-3 py-1 text-sm"
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="void">Void</option>
              </select>
              <Input placeholder="Search bills..." value={search} onChange={e => setSearch(e.target.value)} className="w-[250px]" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="rounded-md border">
                <div className="grid grid-cols-[100px_1fr_120px_120px_100px_120px_100px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                  <div>Number</div>
                  <div>Vendor</div>
                  <div>Issue Date</div>
                  <div>Due Date</div>
                  <div>Status</div>
                  <div className="text-right">Total</div>
                  <div className="text-right">Actions</div>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  {bills.filter(b => 
                    !search || 
                    b.billNumber?.toLowerCase().includes(search.toLowerCase()) || 
                    b.vendorName?.toLowerCase().includes(search.toLowerCase())
                  ).map(b => (
                    <div key={b.id} className="grid grid-cols-[100px_1fr_120px_120px_100px_120px_100px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                      <div className="font-mono font-medium">{b.billNumber}</div>
                      <div className="font-medium">{b.vendorName}</div>
                      <div className="text-sm text-muted-foreground">{formatDate(b.issueDate)}</div>
                      <div className="text-sm text-muted-foreground">{formatDate(b.dueDate)}</div>
                      <div>
                        <Badge variant={statusConfig[b.status].variant} className={statusConfig[b.status].className}>
                          {statusConfig[b.status].label}
                        </Badge>
                      </div>
                      <div className="text-right font-medium">{formatCurrency(Number(b.total))}</div>
                      <div className="flex items-center gap-1 justify-end">
                        <button className="p-1 text-muted-foreground hover:text-primary" title="View"><Eye className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                  {bills.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">No bills found</div>
                  )}
                </div>
              </div>
            )}

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {pagination.page} of {pagination.totalPages}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}