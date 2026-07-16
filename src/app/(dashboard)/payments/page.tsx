'use client';

import { useState } from 'react';
import { Plus, Search, ChevronDown, ChevronRight, ChevronLeft, Eye, Edit, Archive, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'customer' | 'vendor'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'posted'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const customerPaymentsQuery = trpc.payments.listCustomerPayments.useQuery(
    { page, pageSize },
    { enabled: filterType === 'all' || filterType === 'customer' }
  );

  const vendorPaymentsQuery = trpc.payments.listVendorPayments.useQuery(
    { page, pageSize },
    { enabled: filterType === 'all' || filterType === 'vendor' }
  );

  const customerPayments = customerPaymentsQuery.data?.payments || [];
  const vendorPayments = vendorPaymentsQuery.data?.payments || [];
  const pagination = customerPaymentsQuery.data?.pagination || vendorPaymentsQuery.data?.pagination;

  const isLoading = (filterType === 'all' || filterType === 'customer') && customerPaymentsQuery.isLoading ||
                    (filterType === 'all' || filterType === 'vendor') && vendorPaymentsQuery.isLoading;

  const totalPages = Math.ceil((customerPayments.length + vendorPayments.length) / pageSize);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
            <p className="text-muted-foreground">Record and manage customer and vendor payments</p>
          </div>
          <Button asChild>
            <a href="/dashboard/payments/new">Record Payment</a>
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>All Payments</CardTitle>
            <div className="flex items-center gap-4">
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value as 'all' | 'customer' | 'vendor')}
                className="border rounded px-3 py-1 text-sm"
              >
                <option value="all">All Types</option>
                <option value="customer">Customer Payments</option>
                <option value="vendor">Vendor Payments</option>
              </select>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as 'all' | 'pending' | 'posted')}
                className="border rounded px-3 py-1 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="posted">Posted</option>
              </select>
              <Input placeholder="Search payments..." value={search} onChange={e => setSearch(e.target.value)} className="w-[250px]" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="rounded-md border">
                <div className="grid grid-cols-[100px_1fr_100px_120px_100px_120px_100px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                  <div>Reference</div>
                  <div>Party</div>
                  <div>Type</div>
                  <div>Date</div>
                  <div>Status</div>
                  <div className="text-right">Amount</div>
                  <div className="text-right">Actions</div>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  {customerPayments.map(p => (
                    <div key={p.id} className="grid grid-cols-[100px_1fr_100px_120px_100px_120px_100px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                      <div className="font-mono font-medium">PAY-{p.id.slice(0, 8)}</div>
                      <div className="font-medium">{p.customerName}</div>
                      <div className="text-sm text-muted-foreground">customer</div>
                      <div className="text-sm text-muted-foreground">{formatDate(p.paymentDate)}</div>
                      <div>
                        <Badge variant={p.journalEntryId ? 'default' : 'outline'}>
                          {p.journalEntryId ? 'posted' : 'pending'}
                        </Badge>
                      </div>
                      <div className="text-right font-medium">{formatCurrency(Number(p.amount))}</div>
                      <div className="flex items-center gap-1 justify-end">
                        <button className="p-1 text-muted-foreground hover:text-primary" title="View"><Eye className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                  {vendorPayments.map(p => (
                    <div key={p.id} className="grid grid-cols-[100px_1fr_100px_120px_100px_120px_100px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                      <div className="font-mono font-medium">PAY-{p.id.slice(0, 8)}</div>
                      <div className="font-medium">{p.vendorName}</div>
                      <div className="text-sm text-muted-foreground">vendor</div>
                      <div className="text-sm text-muted-foreground">{formatDate(p.paymentDate)}</div>
                      <div>
                        <Badge variant={p.journalEntryId ? 'default' : 'outline'}>
                          {p.journalEntryId ? 'posted' : 'pending'}
                        </Badge>
                      </div>
                      <div className="text-right font-medium">{formatCurrency(Number(p.amount))}</div>
                      <div className="flex items-center gap-1 justify-end">
                        <button className="p-1 text-muted-foreground hover:text-primary" title="View"><Eye className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                  {customerPayments.length === 0 && vendorPayments.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">No payments found</div>
                  )}
                </div>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {Math.min(page * pageSize, customerPayments.length + vendorPayments.length)} of {customerPayments.length + vendorPayments.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}