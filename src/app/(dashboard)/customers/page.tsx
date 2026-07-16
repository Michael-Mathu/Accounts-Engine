'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function CustomersPage() {
  const { data, isLoading, error } = trpc.customers.list.useQuery({});

  const customers = data?.customers || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
            <p className="text-muted-foreground">Manage your customers and their payment terms</p>
          </div>
          <Button asChild>
            <Link href="/dashboard/customers/new">New Customer</Link>
          </Button>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Failed to load customers: {error.message}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>All Customers</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading customers...</p>
                </div>
              </div>
            ) : customers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No customers found.</p>
                <Button asChild variant="link" className="mt-2">
                  <Link href="/dashboard/customers/new">Create your first customer</Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <div className="grid grid-cols-[1fr_200px_120px_120px_120px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                  <div>Name</div>
                  <div>Email</div>
                  <div>Payment Terms</div>
                  <div>Created</div>
                  <div className="text-right">Actions</div>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  {customers.map(customer => (
                    <div key={customer.id} className="grid grid-cols-[1fr_200px_120px_120px_120px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-sm text-muted-foreground">{customer.email || '—'}</div>
                      <div className="text-sm">{customer.paymentTermsDays} days</div>
                      <div className="text-sm text-muted-foreground">{customer.createdAt ? formatDate(customer.createdAt) : '—'}</div>
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon" asChild title="View">
                          <Link href={`/dashboard/customers/${customer.id}`}>
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