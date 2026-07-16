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

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'partial' | 'paid' | 'void';
  total: number;
}

const sampleInvoices: Invoice[] = [
  { id: '1', invoiceNumber: 'INV-2024-001', customerName: 'Acme Corporation', issueDate: '2024-03-01', dueDate: '2024-03-31', status: 'paid', total: 15000 },
  { id: '2', invoiceNumber: 'INV-2024-002', customerName: 'TechStart Inc', issueDate: '2024-03-15', dueDate: '2024-03-30', status: 'sent', total: 8500 },
  { id: '3', invoiceNumber: 'INV-2024-003', customerName: 'Global Industries', issueDate: '2024-03-20', dueDate: '2024-05-04', status: 'partial', total: 42000 },
  { id: '4', invoiceNumber: 'INV-2024-004', customerName: 'Local Coffee Co', issueDate: '2024-03-25', dueDate: '2024-04-01', status: 'draft', total: 2800 },
  { id: '5', invoiceNumber: 'INV-2024-005', customerName: 'Metro Transit Authority', issueDate: '2024-03-28', dueDate: '2024-05-28', status: 'void', total: 150000 },
];

const statusConfig = {
  all: { label: 'All', variant: 'secondary' as const, className: '' },
  draft: { label: 'Draft', variant: 'secondary' as const, className: '' },
  sent: { label: 'Sent', variant: 'default' as const, className: '' },
  partial: { label: 'Partial', variant: 'outline' as const, className: '' },
  paid: { label: 'Paid', variant: 'default' as const, className: 'bg-green-100 text-green-700' },
  void: { label: 'Void', variant: 'destructive' as const, className: '' },
};

export default function InvoicesPage() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'sent' | 'partial' | 'paid' | 'void'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredInvoices = sampleInvoices.filter(inv => {
    if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
    if (search && !inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) && 
        !inv.customerName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredInvoices.length / 10);
  const paginatedInvoices = filteredInvoices.slice((page - 1) * 10, page * 10);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
            <p className="text-muted-foreground">Manage customer invoices</p>
          </div>
          <Button asChild>
            <a href="/dashboard/invoices/new">New Invoice</a>
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>All Invoices</CardTitle>
            <div className="flex items-center gap-4">
              <Select value={filterStatus} onValueChange={setFilterStatus as (value: string) => void}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} className="w-[250px]" />
            </div>
          </CardHeader>
          <CardContent>
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
                {filteredInvoices.map(inv => (
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
                    <div className="text-right font-medium">{formatCurrency(inv.total)}</div>
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