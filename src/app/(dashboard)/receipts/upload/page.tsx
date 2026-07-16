'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Upload, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function UploadReceiptPage() {
  const [fileUrl, setFileUrl] = useState('');
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState('');

  const utils = trpc.useUtils();

  const uploadMutation = trpc.receipts.upload.useMutation({
    onSuccess: () => {
      utils.receipts.list.invalidate();
    },
  });

  const isSubmitting = uploadMutation.isPending;
  const error = uploadMutation.error?.message || null;
  const isSuccess = uploadMutation.isSuccess;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fileUrl) return;

    try {
      await uploadMutation.mutateAsync({
        fileUrl,
        vendor: vendor || undefined,
        date: date || undefined,
      });

      setFileUrl('');
      setVendor('');
      setDate('');
    } catch {
      // Error handled by mutation state
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Upload Receipt</h1>
            <p className="text-muted-foreground">Upload a receipt for AI processing</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/receipts">Back to Receipts</Link>
          </Button>
        </div>

        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-4">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {isSuccess && (
          <Card className="border-green-500 bg-green-50">
            <CardContent className="pt-4">
              <p className="text-green-700">Receipt uploaded successfully!</p>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="fileUrl">Receipt Image URL *</Label>
            <Input
              id="fileUrl"
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://example.com/receipt.jpg"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor (Optional)</Label>
            <Input
              id="vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Vendor name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date (Optional)</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" asChild>
              <Link href="/dashboard/receipts">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting || !fileUrl}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Upload Receipt'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}