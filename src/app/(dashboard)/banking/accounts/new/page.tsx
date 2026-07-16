'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function CreateBankAccountPage() {
  const [name, setName] = useState('');
  const [ledgerAccountId, setLedgerAccountId] = useState('');
  const [currency, setCurrency] = useState('USD');

  const { data: accountsData, isLoading: accountsLoading } = trpc.accounts.list.useQuery({
    includeInactive: false,
  });

  const utils = trpc.useUtils();

  const createMutation = trpc.bankAccounts.create.useMutation({
    onSuccess: () => {
      utils.bankAccounts.list.invalidate();
    },
  });

  const ledgerAccounts = accountsData?.accounts || [];

  const isLoading = accountsLoading;
  const isSubmitting = createMutation.isPending;
  const error = createMutation.error?.message || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !ledgerAccountId) return;

    try {
      await createMutation.mutateAsync({
        name,
        ledgerAccountId,
        currency,
      });

      setName('');
      setLedgerAccountId('');
      setCurrency('USD');
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
            <h1 className="text-3xl font-bold tracking-tight">New Bank Account</h1>
            <p className="text-muted-foreground">Connect a bank account for transactions</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/banking">Back to Banking</Link>
          </Button>
        </div>

        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-4">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="name">Account Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Operating Checking"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ledgerAccountId">Ledger Account *</Label>
            <Select value={ledgerAccountId} onValueChange={setLedgerAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select ledger account" />
              </SelectTrigger>
              <SelectContent>
                {ledgerAccounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.code} - {acc.name} ({acc.accountClass})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="USD"
              maxLength={3}
              required
            />
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" asChild>
              <Link href="/dashboard/banking">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting || !name || !ledgerAccountId}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Account'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}