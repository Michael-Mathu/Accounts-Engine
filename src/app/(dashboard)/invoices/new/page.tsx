'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

interface InvoiceLine {
  tempId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  revenueAccountId: string;
}

export default function CreateInvoicePage() {
  const [lines, setLines] = useState<InvoiceLine[]>([
    { tempId: '1', description: '', quantity: 1, unitPrice: 0, revenueAccountId: '' },
  ]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [taxTotal, setTaxTotal] = useState(0);

  const { data: customersData, isLoading: customersLoading } = trpc.customers.list.useQuery({ pageSize: 100 });
  const { data: revenueAccountsData, isLoading: accountsLoading } = trpc.accounts.list.useQuery({ pageSize: 100 });

  const utils = trpc.useUtils();

  const createMutation = trpc.invoices.create.useMutation({
    onSuccess: () => {
      utils.invoices.list.invalidate();
    },
  });

  const customers = customersData?.customers || [];
  const revenueAccounts = useMemo(() => {
    return (revenueAccountsData?.accounts || []).filter(acc => acc.accountClass === 'revenue');
  }, [revenueAccountsData]);

  const subtotal = lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0);
  const total = subtotal + taxTotal;

  const isLoading = customersLoading || accountsLoading;
  const isSubmitting = createMutation.isPending;
  const error = createMutation.error?.message || null;

  const updateLine = (tempId: string, field: keyof InvoiceLine, value: string | number) => {
    setLines(prev => prev.map(line =>
      line.tempId === tempId ? { ...line, [field]: value } : line
    ));
  };

  const addLine = () => {
    const newId = Date.now().toString();
    setLines(prev => [...prev, {
      tempId: newId,
      description: '',
      quantity: 1,
      unitPrice: 0,
      revenueAccountId: '',
    }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId || !invoiceNumber || !issueDate || !dueDate) {
      return;
    }

    const missingAccounts = lines.some(l => !l.revenueAccountId);
    if (missingAccounts) return;

    try {
      await createMutation.mutateAsync({
        customerId,
        invoiceNumber,
        issueDate,
        dueDate,
        taxTotal,
        lines: lines.map(l => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          revenueAccountId: l.revenueAccountId,
        })),
      });

      // Reset form on success
      setLines([{ tempId: '1', description: '', quantity: 1, unitPrice: 0, revenueAccountId: '' }]);
      setInvoiceNumber('');
      setCustomerId('');
      setIssueDate('');
      setDueDate('');
      setTaxTotal(0);
    } catch {
      // Error handled by mutation state
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Invoice</h1>
            <p className="text-muted-foreground">Create a new customer invoice</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/invoices">Back to List</Link>
          </Button>
        </div>

        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-4">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-2024-001"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerId">Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue Date</Label>
              <Input
                id="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button type="button" onClick={addLine} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-4 p-2 bg-muted/50 rounded text-sm font-medium">
                  <div className="col-span-4">Account</div>
                  <div className="col-span-4">Description</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Price</div>
                </div>

                {lines.map((line) => (
                  <div key={line.tempId} className="grid grid-cols-12 gap-4 items-center p-2 border-b last:border-b-0">
                    <div className="col-span-4">
                      <Select value={line.revenueAccountId} onValueChange={(v) => updateLine(line.tempId, 'revenueAccountId', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select revenue account" />
                        </SelectTrigger>
                        <SelectContent>
                          {revenueAccounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-4">
                      <Input
                        placeholder="Item description"
                        value={line.description}
                        onChange={(e) => updateLine(line.tempId, 'description', e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.tempId, 'quantity', parseInt(e.target.value) || 1)}
                        className="text-right"
                      />
                    </div>

                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.tempId, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="text-right"
                        required
                      />
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-12 gap-4 p-2 bg-muted/50 font-medium">
                  <div className="col-span-8 text-right">Subtotal:</div>
                  <div className="col-span-4 text-right">{formatCurrency(subtotal)}</div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3 text-right">Tax:</div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={taxTotal}
                      onChange={(e) => setTaxTotal(parseFloat(e.target.value) || 0)}
                      className="text-right"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-4 p-2 bg-muted/50 font-bold">
                  <div className="col-span-8 text-right">Total:</div>
                  <div className="col-span-4 text-right">{formatCurrency(total)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button variant="outline" asChild>
              <Link href="/dashboard/invoices">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting || !customerId || !invoiceNumber || lines.some(l => !l.revenueAccountId || !l.description)}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Invoice'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}