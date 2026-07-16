'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Eye, FileText, CheckCircle, XCircle, Clock, AlertTriangle, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

const statusConfig = {
  pending: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
  processing: { label: 'Processing', variant: 'default' as const, icon: Clock },
  processed: { label: 'Processed', variant: 'outline' as const, icon: FileText },
  failed: { label: 'Failed', variant: 'destructive' as const, icon: AlertTriangle },
  approved: { label: 'Approved', variant: 'default' as const, icon: CheckCircle },
  rejected: { label: 'Rejected', variant: 'destructive' as const, icon: XCircle },
};

export default function ReceiptsPage() {
  const [activeTab, setActiveTab] = useState<'list' | 'upload'>('list');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'processing' | 'processed' | 'failed' | 'approved' | 'rejected'>('all');

  const { data: receiptsData, isLoading, error } = trpc.receipts.list.useQuery();

  const receipts = (receiptsData || []).filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (search && r.extractedData && JSON.stringify(r.extractedData).toLowerCase().includes(search.toLowerCase())) return true;
    if (search && r.fileUrl?.toLowerCase().includes(search.toLowerCase())) return true;
    if (!search) return true;
    return false;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Receipts</h1>
            <p className="text-muted-foreground">Upload receipts and process with AI extraction</p>
          </div>
          <Button asChild>
            <a href="/dashboard/receipts/upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload Receipt
            </a>
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab as (value: string) => void} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">All Receipts</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>All Receipts</CardTitle>
                <div className="flex items-center gap-4">
                  <Select value={filterStatus} onValueChange={setFilterStatus as (value: string) => void}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="processed">Processed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Search receipts..." value={search} onChange={e => setSearch(e.target.value)} className="w-[250px]" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading receipts...</p>
                ) : receipts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No receipts found.</p>
                    <Button asChild variant="link" className="mt-2">
                      <a href="/dashboard/receipts/upload">Upload your first receipt</a>
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <div className="grid grid-cols-[120px_1fr_100px_100px_100px_100px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                      <div>Date</div>
                      <div>Vendor</div>
                      <div>Amount</div>
                      <div>Status</div>
                      <div>Extracted</div>
                      <div className="text-right">Actions</div>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto">
                      {receipts.map(r => (
                        <div key={r.id} className="grid grid-cols-[120px_1fr_100px_100px_100px_100px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                          <div className="text-sm">{r.createdAt ? formatDate(r.createdAt) : '-'}</div>
                          <div className="font-medium">
                            {r.extractedData && typeof r.extractedData === 'object' && 'merchant' in r.extractedData 
                              ? String(r.extractedData.merchant) 
                              : 'Unknown'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {r.extractedData && typeof r.extractedData === 'object' && 'total' in r.extractedData 
                              ? formatCurrency(Number(r.extractedData.total)) 
                              : '-'}
                          </div>
                          <div>
                            <Badge variant={statusConfig[r.status].variant}>
                              {statusConfig[r.status].label}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {r.extractedData ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                          </div>
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="icon" asChild title="View">
                              <Link href={`/dashboard/receipts/${r.id}`}>
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
          </TabsContent>

          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload Receipt</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Drag and drop a receipt image here</p>
                  <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                  <Button className="mt-4" variant="outline">Choose File</Button>
                  <p className="text-xs text-muted-foreground mt-2">Supports JPG, PNG, PDF up to 10MB</p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Recent Uploads</h3>
                  {receipts.slice(0, 5).map(r => (
                    <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">
                          {r.extractedData && typeof r.extractedData === 'object' && 'merchant' in r.extractedData 
                            ? String(r.extractedData.merchant) 
                            : 'receipt.jpg'}
                        </p>
                        <p className="text-xs text-muted-foreground">{r.createdAt ? formatDate(r.createdAt) : '-'}</p>
                      </div>
                      <Badge variant={statusConfig[r.status].variant} className="text-xs">
                        {statusConfig[r.status].label}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}