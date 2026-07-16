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

export default function CreateFixedAssetPage() {
  const [name, setName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [cost, setCost] = useState('');
  const [salvageValue, setSalvageValue] = useState('0');
  const [usefulLifeYears, setUsefulLifeYears] = useState('');
  const [method, setMethod] = useState('straight_line');
  const [assetAccountId, setAssetAccountId] = useState('');
  const [accumulatedDepreciationAccountId, setAccumulatedDepreciationAccountId] = useState('');

  const { data: accountsData, isLoading: accountsLoading } = trpc.accounts.list.useQuery({
    includeInactive: false,
  });

  const utils = trpc.useUtils();

  const createMutation = trpc.tax.createFixedAsset.useMutation({
    onSuccess: () => {
      utils.tax.listFixedAssets.invalidate();
    },
  });

  const accounts = accountsData?.accounts || [];

  const isLoading = accountsLoading;
  const isSubmitting = createMutation.isPending;
  const error = createMutation.error?.message || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !purchaseDate || !cost || !usefulLifeYears || !assetAccountId || !accumulatedDepreciationAccountId) return;

    try {
      await createMutation.mutateAsync({
        name,
        purchaseDate,
        cost: parseFloat(cost),
        salvageValue: parseFloat(salvageValue) || 0,
        usefulLifeYears: parseInt(usefulLifeYears),
        method: method as 'straight_line' | 'declining_balance' | 'sum_of_years_digits',
        assetAccountId,
        accumulatedDepreciationAccountId,
      });

      setName('');
      setPurchaseDate('');
      setCost('');
      setSalvageValue('0');
      setUsefulLifeYears('');
      setMethod('straight_line');
      setAssetAccountId('');
      setAccumulatedDepreciationAccountId('');
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
            <h1 className="text-3xl font-bold tracking-tight">New Fixed Asset</h1>
            <p className="text-muted-foreground">Add a company asset for depreciation</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/fixed-assets">Back to Assets</Link>
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
            <Label htmlFor="name">Asset Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Office Equipment"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchaseDate">Purchase Date *</Label>
            <Input
              id="purchaseDate"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost">Cost *</Label>
            <Input
              id="cost"
              type="number"
              step="0.01"
              min="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="e.g., 5000.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="salvageValue">Salvage Value</Label>
            <Input
              id="salvageValue"
              type="number"
              step="0.01"
              min="0"
              value={salvageValue}
              onChange={(e) => setSalvageValue(e.target.value)}
              placeholder="e.g., 500.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="usefulLifeYears">Useful Life (years) *</Label>
            <Input
              id="usefulLifeYears"
              type="number"
              min="1"
              value={usefulLifeYears}
              onChange={(e) => setUsefulLifeYears(e.target.value)}
              placeholder="e.g., 5"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Depreciation Method *</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="straight_line">Straight Line</SelectItem>
                <SelectItem value="declining_balance">Declining Balance</SelectItem>
                <SelectItem value="sum_of_years_digits">Sum of Years</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assetAccountId">Asset Account *</Label>
            <Select value={assetAccountId} onValueChange={setAssetAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select asset account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.filter(a => a.accountClass === 'asset').map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.code} - {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accumulatedDepreciationAccountId">Accum. Depreciation Account *</Label>
            <Select value={accumulatedDepreciationAccountId} onValueChange={setAccumulatedDepreciationAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select accumulated depreciation account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.filter(a => a.accountClass === 'asset' && a.name.toLowerCase().includes('depreciation')).map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.code} - {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" asChild>
              <Link href="/dashboard/fixed-assets">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting || !name || !purchaseDate || !cost}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Asset'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}