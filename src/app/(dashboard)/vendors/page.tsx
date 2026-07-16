'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function VendorsPage() {
  const { data, isLoading, error } = trpc.vendors.list.useQuery({});

  const vendors = data?.vendors || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Vendors</h1>
            <p className="text-muted-foreground">Manage your vendors and their information</p>
          </div>
          <Button asChild>
            <Link href="/dashboard/vendors/new">New Vendor</Link>
          </Button>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Failed to load vendors: {error.message}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>All Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading vendors...</p>
                </div>
              </div>
            ) : vendors.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No vendors found.</p>
                <Button asChild variant="link" className="mt-2">
                  <Link href="/dashboard/vendors/new">Create your first vendor</Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <div className="grid grid-cols-[1fr_200px_120px_120px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                  <div>Name</div>
                  <div>Email</div>
                  <div>Created</div>
                  <div className="text-right">Actions</div>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  {vendors.map(vendor => (
                    <div key={vendor.id} className="grid grid-cols-[1fr_200px_120px_120px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                      <div className="font-medium">{vendor.name}</div>
                      <div className="text-sm text-muted-foreground">{vendor.email || '—'}</div>
                      <div className="text-sm text-muted-foreground">{vendor.createdAt ? formatDate(vendor.createdAt) : '—'}</div>
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon" asChild title="View">
                          <Link href={`/dashboard/vendors/${vendor.id}`}>
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