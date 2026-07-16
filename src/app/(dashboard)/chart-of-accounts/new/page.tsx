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

export default function CreateAccountPage() {
  const [accountTypeId, setAccountTypeId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');
  const [scheduleCLineId, setScheduleCLineId] = useState('');

  const { data: accountTypesData, isLoading: typesLoading } = trpc.accountTypes.list.useQuery();
  const { data: parentAccountsData, isLoading: parentsLoading } = trpc.accounts.list.useQuery({
    includeInactive: false,
  });

  const utils = trpc.useUtils();

  const createMutation = trpc.accounts.create.useMutation({
    onSuccess: () => {
      utils.accounts.list.invalidate();
      utils.accounts.getTree.invalidate();
    },
  });

  const accountTypes = accountTypesData || [];
  const parentAccounts = parentAccountsData?.accounts || [];

  const isLoading = typesLoading || parentsLoading;
  const isSubmitting = createMutation.isPending;
  const error = createMutation.error?.message || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accountTypeId || !code || !name) return;

    try {
      await createMutation.mutateAsync({
        accountTypeId: parseInt(accountTypeId),
        code,
        name,
        description: description || undefined,
        parentId: parentId || undefined,
        scheduleCLineId: scheduleCLineId || undefined,
      });

      setAccountTypeId('');
      setCode('');
      setName('');
      setDescription('');
      setParentId('');
      setScheduleCLineId('');
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
            <h1 className="text-3xl font-bold tracking-tight">New Account</h1>
            <p className="text-muted-foreground">Create a new ledger account</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/chart-of-accounts">Back to Chart</Link>
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
            <Label htmlFor="accountTypeId">Account Type *</Label>
            <Select value={accountTypeId} onValueChange={setAccountTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent>
                {accountTypes.map(type => (
                  <SelectItem key={type.id} value={String(type.id)}>
                    {type.name} ({type.class})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Account Code *</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g., 1000"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Account Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Cash"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="parentId">Parent Account</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue placeholder="Optional parent account" />
              </SelectTrigger>
              <SelectContent>
                {parentAccounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.code} - {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduleCLineId">Schedule C Line (Optional)</Label>
            <Input
              id="scheduleCLineId"
              value={scheduleCLineId}
              onChange={(e) => setScheduleCLineId(e.target.value)}
              placeholder="e.g., 1, 2, 3"
            />
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" asChild>
              <Link href="/dashboard/chart-of-accounts">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting || !accountTypeId || !code || !name}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Account'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}