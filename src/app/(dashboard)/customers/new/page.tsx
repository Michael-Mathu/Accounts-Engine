'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function CreateCustomerPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);

  const utils = trpc.useUtils();

  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
    },
  });

  const isSubmitting = createMutation.isPending;
  const error = createMutation.error?.message || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name) return;

    try {
      await createMutation.mutateAsync({
        name,
        email: email || undefined,
        paymentTermsDays,
      });

      setName('');
      setEmail('');
      setPaymentTermsDays(30);
    } catch {
      // Error handled by mutation state
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Customer</h1>
            <p className="text-muted-foreground">Add a customer to bill</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/customers">Back to List</Link>
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
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentTermsDays">Payment Terms (days)</Label>
            <Input
              id="paymentTermsDays"
              type="number"
              min="1"
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(parseInt(e.target.value) || 30)}
            />
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" asChild>
              <Link href="/dashboard/customers">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting || !name}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Customer'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}