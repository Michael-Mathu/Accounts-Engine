'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Loader2, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

const methodLabels = {
  straight_line: 'Straight Line',
  declining_balance: 'Declining Balance',
  sum_of_years_digits: 'Sum of Years',
};

export default function FixedAssetsPage() {
  const { data, isLoading, error } = trpc.tax.listFixedAssets.useQuery();

  const assets = data || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Fixed Assets</h1>
            <p className="text-muted-foreground">Manage company assets and depreciation</p>
          </div>
          <Button asChild>
            <Link href="/dashboard/fixed-assets/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Asset
            </Link>
          </Button>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Failed to load assets: {error.message}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Fixed Assets</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : assets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No fixed assets configured.</p>
                <Button asChild variant="link" className="mt-2">
                  <Link href="/dashboard/fixed-assets/new">Add your first asset</Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <div className="grid grid-cols-[1fr_120px_120px_120px_120px_120px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                  <div>Name</div>
                  <div>Purchase Date</div>
                  <div>Cost</div>
                  <div>Method</div>
                  <div>Life (years)</div>
                  <div className="text-right">Actions</div>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  {assets.map(asset => (
                    <div key={asset.id} className="grid grid-cols-[1fr_120px_120px_120px_120px_120px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                      <div className="font-medium">{asset.name}</div>
                      <div className="text-sm text-muted-foreground">{formatDate(asset.purchaseDate)}</div>
                      <div className="text-sm">{formatCurrency(Number(asset.cost))}</div>
                      <div className="text-sm">{methodLabels[asset.method]}</div>
                      <div className="text-sm">{asset.usefulLifeYears}</div>
                      <div className="flex items-center gap-1 justify-end">
<Button variant="ghost" size="icon" asChild title="View">
                           <Link href={`/dashboard/fixed-assets/${asset.id}`}>
                             <Eye className="h-4 w-4" />
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