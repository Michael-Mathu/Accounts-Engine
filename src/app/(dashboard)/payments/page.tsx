'use client';

import { useState } from 'react';
import { Plus, Search, ChevronDown, ChevronRight, ChevronLeft, Eye, Edit, Archive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

interface Payment {
  id: string;
  reference: string;
  partyName: string;
  type: 'customer' | 'vendor';
  paymentDate: string;
  amount: number;
  status: 'pending' | 'posted';
}

const samplePayments: Payment[] = [
  { id: '1', reference: 'PAY-CUST-1', partyName: 'Acme Corporation', type: 'customer', paymentDate: '2024-03-15', amount: 12500, status: 'posted' },
  { id: '2', reference: 'PAY-VEND-1', partyName: 'Office Supplies Plus', type: 'vendor', paymentDate: '2024-03-20', amount: 8500, status: 'posted' },
  { id: '3', reference: 'PAY-CUST-2', partyName: 'TechStart Inc', type: 'customer', paymentDate: '2024-03-25', amount: 4500, status: 'pending' },
  { id: '4', reference: 'PAY-VEND-2', partyName: 'Tech Hardware Inc', type: 'vendor', paymentDate: '2024-03-28', amount: 12000, status: 'posted' },
  { id: '5', reference: 'PAY-CUST-3', partyName: 'Global Industries', type: 'customer', paymentDate: '2024-04-01', amount: 28000, status: 'posted' },
  { id: '6', reference: 'PAY-VEND-3', partyName: 'Commercial Rentals LLC', type: 'vendor', paymentDate: '2024-04-05', amount: 24000, status: 'pending' },
];

export default function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'customer' | 'vendor'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'posted'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredPayments = samplePayments.filter(p => {
    if (filterType !== 'all' && p.type !== filterType) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (search && !p.reference.toLowerCase().includes(search.toLowerCase()) && 
        !p.partyName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredPayments.length / 10);
  const paginatedPayments = filteredPayments.slice((page - 1) * 10, page * 10);

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
              <Select value={filterType} onValueChange={setFilterType as (value: string) => void}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="customer">Customer Payments</SelectItem>
                  <SelectItem value="vendor">Vendor Payments</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus as (value: string) => void}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Search payments..." value={search} onChange={e => setSearch(e.target.value)} className="w-[250px]" />
            </div>
          </CardHeader>
          <CardContent>
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
                {filteredPayments.map(p => (
                  <div key={p.id} className="grid grid-cols-[100px_1fr_100px_120px_100px_120px_100px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                    <div className="font-mono font-medium">{p.reference}</div>
                    <div className="font-medium">{p.partyName}</div>
                    <div className="text-sm text-muted-foreground capitalize">{p.type}</div>
                    <div className="text-sm text-muted-foreground">{formatDate(p.paymentDate)}</div>
                    <div>
                      <Badge variant={p.status === 'posted' ? 'default' : 'outline'}>
                        {p.status}
                      </Badge>
                    </div>
                    <div className="text-right font-medium">{formatCurrency(p.amount)}</div>
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100">
                      <button className="p-1 text-muted-foreground hover:text-primary" title="View"><Eye className="h-4 w-4" /></button>
                      <button className="p-1 text-muted-foreground hover:text-primary" title="Edit"><Edit className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {Math.ceil(filteredPayments.length / 10) > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, filteredPayments.length)} of {filteredPayments.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(Math.ceil(filteredPayments.length / 10), p + 1))} disabled={page === Math.ceil(filteredPayments.length / 10)}>
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