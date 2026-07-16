'use client';

import { useState } from 'react';
import { Plus, Search, ChevronDown, ChevronRight, Eye, Edit, Archive, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

interface Bill {
  id: string;
  billNumber: string;
  vendorName: string;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'approved' | 'partial' | 'paid' | 'void';
  total: number;
}

const sampleBills: Bill[] = [
  { id: '1', billNumber: 'BILL-2024-001', vendorName: 'Office Supplies Plus', issueDate: '2024-03-01', dueDate: '2024-03-31', status: 'paid', total: 2500 },
  { id: '2', billNumber: 'BILL-2024-002', vendorName: 'Tech Hardware Inc', issueDate: '2024-03-10', dueDate: '2024-04-09', status: 'approved', total: 12000 },
  { id: '3', billNumber: 'BILL-2024-003', vendorName: 'Commercial Rentals LLC', issueDate: '2024-03-15', dueDate: '2024-04-14', status: 'partial', total: 8000 },
  { id: '4', billNumber: 'BILL-2024-004', vendorName: 'Utilities District', issueDate: '2024-03-20', dueDate: '2024-04-19', status: 'draft', total: 1200 },
  { id: '5', billNumber: 'BILL-2024-005', vendorName: 'Insurance Brokers Co', issueDate: '2024-03-25', dueDate: '2024-04-24', status: 'void', total: 5000 },
];

const statusConfig = {
  all: { label: 'All', variant: 'secondary' as const, className: '' },
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

  const filteredBills = sampleBills.filter(b => {
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (search && !b.billNumber.toLowerCase().includes(search.toLowerCase()) && 
        !b.vendorName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredBills.length / 10);
  const paginatedBills = filteredBills.slice((page - 1) * 10, page * 10);

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
              <Select value={filterStatus} onValueChange={setFilterStatus as (value: string) => void}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Search bills..." value={search} onChange={e => setSearch(e.target.value)} className="w-[250px]" />
            </div>
          </CardHeader>
          <CardContent>
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
                {filteredBills.map(b => (
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
                    <div className="text-right font-medium">{formatCurrency(b.total)}</div>
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100">
                      <button className="p-1 text-muted-foreground hover:text-primary" title="View"><Eye className="h-4 w-4" /></button>
                      <button className="p-1 text-muted-foreground hover:text-primary" title="Edit"><Edit className="h-4 w-4" /></button>
                      <button className="p-1 text-muted-foreground hover:text-destructive" title="Void"><Archive className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}