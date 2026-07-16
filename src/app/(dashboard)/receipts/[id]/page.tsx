'use client';

import { use } from 'react';
import { Loader2, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

const statusConfig = {
  pending: { label: 'Pending', variant: 'secondary' as const },
  processing: { label: 'Processing', variant: 'default' as const },
  processed: { label: 'Processed', variant: 'outline' as const },
  failed: { label: 'Failed', variant: 'destructive' as const },
  approved: { label: 'Approved', variant: 'default' as const },
  rejected: { label: 'Rejected', variant: 'destructive' as const },
};

export default function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.receipts.getById.useQuery({ id });

  const processMutation = trpc.receipts.process.useMutation({
    onSuccess: () => {
      utils.receipts.getById.invalidate({ id });
      utils.receipts.list.invalidate();
    },
  });

  const approveMutation = trpc.receipts.approve.useMutation({
    onSuccess: () => {
      utils.receipts.getById.invalidate({ id });
      utils.receipts.list.invalidate();
    },
  });

  const rejectMutation = trpc.receipts.reject.useMutation({
    onSuccess: () => {
      utils.receipts.getById.invalidate({ id });
      utils.receipts.list.invalidate();
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Receipt not found</p>
            <Button asChild variant="outline" className="mt-4">
              <a href="/dashboard/receipts">Back to Receipts</a>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const { status, fileUrl, extractedData, createdAt } = data;
  const extracted = extractedData && typeof extractedData === 'object' && !Array.isArray(extractedData) 
    ? extractedData as { merchant?: string; date?: string; total?: number; tax?: number; subtotal?: number; currency?: string; lineItems?: unknown[] }
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Receipt Details</h1>
            <p className="text-muted-foreground">{createdAt ? formatDate(createdAt) : '—'}</p>
          </div>
          <Badge variant={statusConfig[status].variant}>
            {statusConfig[status].label}
          </Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Receipt Image</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 text-center">
                <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground break-all">{fileUrl || 'No image'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Extracted Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {extracted ? (
                <>
                  <div>
                    <span className="text-sm text-muted-foreground">Merchant: </span>
                    <span className="font-medium">{extracted.merchant || '—'}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Date: </span>
                    <span className="font-medium">{extracted.date ? formatDate(extracted.date) : '—'}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Subtotal: </span>
                    <span className="font-medium">{extracted.subtotal ? formatCurrency(extracted.subtotal) : '—'}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Tax: </span>
                    <span className="font-medium">{extracted.tax ? formatCurrency(extracted.tax) : '—'}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Total: </span>
                    <span className="font-medium">{extracted.total ? formatCurrency(extracted.total) : '—'}</span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">No data extracted yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            {status === 'pending' && (
              <Button
                variant="default"
                onClick={() => processMutation.mutate({ id })}
                disabled={processMutation.isPending}
              >
                {processMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Process'}
              </Button>
            )}
            {status === 'processed' && (
              <>
                <Button
                  variant="default"
                  onClick={() => approveMutation.mutate({ id })}
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => rejectMutation.mutate({ id, reason: 'Manual rejection' })}
                  disabled={rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
                </Button>
              </>
            )}
            <Button variant="outline" asChild>
              <a href="/dashboard/receipts">Back to List</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}