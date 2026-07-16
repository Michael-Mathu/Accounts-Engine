'use client';

import { useState } from 'react';
import { Plus, Search, ChevronDown, ChevronRight, ChevronLeft, Eye, Edit, Archive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

interface Vendor {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
}

const sampleVendors: Vendor[] = [
  { id: '1', name: 'Office Supplies Plus', email: 'orders@officesuppliesplus.com', isActive: true, createdAt: '2024-01-10' },
  { id: '2', name: 'Tech Hardware Inc', email: 'sales@techhardware.com', isActive: true, createdAt: '2024-02-15' },
  { id: '3', name: 'Commercial Rentals LLC', email: 'billing@commercialrentals.com', isActive: true, createdAt: '2024-01-20' },
  { id: '4', name: 'Utilities District', email: 'billing@utilitiesdistrict.gov', isActive: true, createdAt: '2024-03-01' },
  { id: '5', name: 'Insurance Brokers Co', email: 'accounts@insurancebrokers.com', isActive: false, createdAt: '2024-02-28' },
];

export default function VendorsPage() {
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredVendors = sampleVendors.filter(v => {
    if (filterActive === 'active' && !v.isActive) return false;
    if (filterActive === 'inactive' && v.isActive) return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase()) && 
        !v.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredVendors.length / pageSize);
  const paginatedVendors = filteredVendors.slice((page - 1) * pageSize, page * pageSize);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Vendors</h1>
            <p className="text-muted-foreground">Manage your vendors and their information</p>
          </div>
          <Button asChild>
            <a href="/dashboard/vendors/new">New Vendor</a>
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>All Vendors</CardTitle>
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
                placeholder="Search vendors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[250px]"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <div className="grid grid-cols-[1fr_200px_120px_120px_120px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                <div>Name</div>
                <div>Email</div>
                <div>Status</div>
                <div>Created</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {filteredVendors.map(vendor => (
                  <div key={vendor.id} className="grid grid-cols-[1fr_200px_120px_120px_120px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                    <div className="font-medium">{vendor.name}</div>
                    <div className="text-sm text-muted-foreground">{vendor.email}</div>
                    <div>
                      <Badge variant={vendor.isActive ? 'default' : 'secondary'}>
                        {vendor.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{vendor.createdAt}</div>
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100">
                      <button className="p-1 text-muted-foreground hover:text-primary" title="View"><Eye className="h-4 w-4" /></button>
                      <button className="p-1 text-muted-foreground hover:text-primary" title="Edit"><Edit className="h-4 w-4" /></button>
                      <button className="p-1 text-muted-foreground hover:text-destructive" title="Archive"><Archive className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {Math.ceil(filteredVendors.length / pageSize) > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, filteredVendors.length)} of {filteredVendors.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(Math.ceil(filteredVendors.length / pageSize), p + 1))} disabled={page === Math.ceil(filteredVendors.length / pageSize)}>
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