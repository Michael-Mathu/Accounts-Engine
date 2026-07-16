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

export default function CreateVendorPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const utils = trpc.useUtils();

  const createMutation = trpc.vendors.create.useMutation({
    onSuccess: () => {
      utils.vendors.list.invalidate();
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
      });

      setName('');
      setEmail('');
    } catch {
      // Error handled by mutation state
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Vendor</h1>
            <p className="text-muted-foreground">Add a vendor to bill</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/vendors">Back to List</Link>
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
              placeholder="Vendor name"
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
              placeholder="vendor@example.com"
            />
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" asChild>
              <Link href="/dashboard/vendors">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting || !name}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Vendor'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}