'use client';

import { useState } from 'react';
import { Plus, Search, ChevronDown, ChevronRight, ChevronLeft, Eye, Edit, Archive, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

interface Customer {
  id: string;
  name: string;
  email: string;
  paymentTermsDays: number;
  isActive: boolean;
  createdAt: string;
}

const sampleCustomers: Customer[] = [
  { id: '1', name: 'Acme Corporation', email: 'billing@acme.com', paymentTermsDays: 30, isActive: true, createdAt: '2024-01-15' },
  { id: '2', name: 'TechStart Inc', email: 'accounts@techstart.io', paymentTermsDays: 15, isActive: true, createdAt: '2024-02-20' },
  { id: '3', name: 'Global Industries', email: 'ap@globalind.com', paymentTermsDays: 45, isActive: true, createdAt: '2024-03-10' },
  { id: '4', name: 'Local Coffee Co', email: 'owner@localcoffee.com', paymentTermsDays: 7, isActive: true, createdAt: '2024-04-05' },
  { id: '5', name: 'Metro Transit Authority', email: 'finance@metro.gov', paymentTermsDays: 60, isActive: false, createdAt: '2024-01-30' },
];

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredCustomers = sampleCustomers.filter(c => {
    if (filterActive === 'active' && !c.isActive) return false;
    if (filterActive === 'inactive' && c.isActive) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && 
        !c.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredCustomers.length / pageSize);
  const paginatedCustomers = filteredCustomers.slice((page - 1) * pageSize, page * pageSize);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
            <p className="text-muted-foreground">Manage your customers and their payment terms</p>
          </div>
          <Button asChild>
            <a href="/dashboard/customers/new">New Customer</a>
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>All Customers</CardTitle>
            <div className="flex items-center gap-4">
              <Select value={filterActive} onValueChange={setFilterActive as (value: string) => void}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[250px]"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <div className="grid grid-cols-[80px_1fr_200px_120px_100px_120px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                <div>Name</div>
                <div>Email</div>
                <div>Payment Terms</div>
                <div>Status</div>
                <div>Created</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {paginatedCustomers.map(customer => (
                  <div key={customer.id} className="grid grid-cols-[80px_1fr_200px_120px_100px_120px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-sm text-muted-foreground">{customer.email}</div>
                    <div className="text-sm">{customer.paymentTermsDays} days</div>
                    <div>
                      <Badge variant={customer.isActive ? 'default' : 'secondary'}>
                        {customer.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{customer.createdAt}</div>
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100">
                      <button className="p-1 text-muted-foreground hover:text-primary" title="View"><Eye className="h-4 w-4" /></button>
                      <button className="p-1 text-muted-foreground hover:text-primary" title="Edit"><Edit className="h-4 w-4" /></button>
                      <button className="p-1 text-muted-foreground hover:text-destructive" title={customer.isActive ? 'Archive' : 'Activate'}><Archive className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, filteredCustomers.length)} of {filteredCustomers.length}
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