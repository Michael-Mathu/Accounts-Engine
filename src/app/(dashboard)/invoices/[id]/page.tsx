'use client';

import { use } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

const statusConfig = {
  draft: { label: 'Draft', variant: 'secondary' as const, className: '' },
  sent: { label: 'Sent', variant: 'default' as const, className: '' },
  partial: { label: 'Partial', variant: 'outline' as const, className: '' },
  paid: { label: 'Paid', variant: 'default' as const, className: 'bg-green-100 text-green-700' },
  void: { label: 'Void', variant: 'destructive' as const, className: '' },
};

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.invoices.getById.useQuery({ id });

  const sendMutation = trpc.invoices.send.useMutation({
    onSuccess: () => {
      utils.invoices.getById.invalidate({ id });
      utils.invoices.list.invalidate();
    },
  });

  const voidMutation = trpc.invoices.void.useMutation({
    onSuccess: () => {
      utils.invoices.getById.invalidate({ id });
      utils.invoices.list.invalidate();
    },
  });

  const handleClickSend = () => sendMutation.mutate({ id });
  const handleClickVoid = () => voidMutation.mutate({ id });

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
            <p className="text-destructive">Invoice not found</p>
            <Button asChild variant="outline" className="mt-4">
              <a href="/dashboard/invoices">Back to Invoices</a>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const { invoiceNumber, status, issueDate, dueDate, total, subtotal, taxTotal, customer, lines } = data;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{invoiceNumber}</h1>
            <p className="text-muted-foreground">Invoice details</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusConfig[status].variant} className={statusConfig[status].className}>
              {statusConfig[status].label}
            </Badge>
            {status === 'draft' && (
              <Button
                variant="default"
                size="sm"
                onClick={handleClickSend}
                disabled={sendMutation.isPending}
              >
                {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
              </Button>
            )}
            {status !== 'void' && status !== 'paid' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClickVoid}
                disabled={voidMutation.isPending}
              >
                {voidMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Void'}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{customer?.name}</p>
              <p className="text-sm text-muted-foreground">{customer?.email || '—'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm text-muted-foreground">Issue: </span>
                {formatDate(issueDate)}
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Due: </span>
                {formatDate(dueDate)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(Number(subtotal))}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{formatCurrency(Number(taxTotal))}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-2">
                <span>Total</span>
                <span>{formatCurrency(Number(total))}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <div className="grid grid-cols-[200px_1fr_100px_100px_100px] gap-4 p-3 bg-muted/50 text-xs font-medium border-b">
                <div>Account</div>
                <div>Description</div>
                <div className="text-right">Qty</div>
                <div className="text-right">Price</div>
                <div className="text-right">Amount</div>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {lines.map(line => (
                  <div key={line.id} className="grid grid-cols-[200px_1fr_100px_100px_100px] gap-4 p-3 border-b last:border-b-0">
                    <div className="text-sm font-mono">
                      {line.revenueAccountCode} - {line.revenueAccountName}
                    </div>
                    <div className="text-sm">{line.description}</div>
                    <div className="text-sm text-right">{line.quantity}</div>
                    <div className="text-sm text-right">{formatCurrency(Number(line.unitPrice))}</div>
                    <div className="text-sm text-right font-medium">{formatCurrency(Number(line.amount))}</div>
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