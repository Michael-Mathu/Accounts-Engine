'use client';

import { useState } from 'react';
import { Plus, Search, ChevronDown, ChevronRight, Eye, Edit, Archive, Upload, FileText, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

interface Receipt {
  id: string;
  fileUrl: string;
  vendor: string | null;
  date: string | null;
  status: 'pending' | 'processing' | 'processed' | 'failed' | 'approved' | 'rejected';
  extractedData: { merchant?: string; total?: number; tax?: number; lineItems?: unknown[] } | null;
  draftJournalEntryId: string | null;
  createdAt: string;
}

const sampleReceipts: Receipt[] = [
  { id: '1', fileUrl: 'https://example.com/receipt1.jpg', vendor: 'Office Depot', date: '2024-03-15', status: 'approved', extractedData: { merchant: 'Office Depot', total: 125.50, tax: 10.50, lineItems: [] }, draftJournalEntryId: 'je_1', createdAt: '2024-03-15T10:30:00Z' },
  { id: '2', fileUrl: 'https://example.com/receipt2.jpg', vendor: 'Amazon', date: '2024-03-14', status: 'processed', extractedData: { merchant: 'Amazon', total: 89.99, tax: 7.50, lineItems: [] }, draftJournalEntryId: 'je_2', createdAt: '2024-03-14T14:20:00Z' },
  { id: '3', fileUrl: 'https://example.com/receipt3.jpg', vendor: 'Starbucks', date: '2024-03-13', status: 'pending', extractedData: null, draftJournalEntryId: null, createdAt: '2024-03-13T09:15:00Z' },
  { id: '4', fileUrl: 'https://example.com/receipt4.jpg', vendor: 'Uber', date: '2024-03-12', status: 'failed', extractedData: null, draftJournalEntryId: null, createdAt: '2024-03-12T18:45:00Z' },
  { id: '5', fileUrl: 'https://example.com/receipt5.jpg', vendor: 'Staples', date: '2024-03-11', status: 'approved', extractedData: { merchant: 'Staples', total: 45.00, tax: 3.60, lineItems: [] }, draftJournalEntryId: 'je_3', createdAt: '2024-03-11T11:00:00Z' },
];

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
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredReceipts = sampleReceipts.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (search && !r.vendor?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredReceipts.length / 10);
  const paginatedReceipts = filteredReceipts.slice((page - 1) * 10, page * 10);

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
                <div className="rounded-md border">
                  <div className="grid grid-cols-[120px_1fr_100px_100px_100px_100px_100px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                    <div>Date</div>
                    <div>Vendor</div>
                    <div>Amount</div>
                    <div>Status</div>
                    <div>Extracted</div>
                    <div>JE</div>
                    <div className="text-right">Actions</div>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto">
                    {sampleReceipts.map(r => (
                      <div key={r.id} className="grid grid-cols-[120px_1fr_100px_100px_100px_100px_100px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                        <div className="text-sm">{formatDate(r.date || r.createdAt)}</div>
                        <div className="font-medium">{r.vendor || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground">{r.extractedData?.total ? formatCurrency(r.extractedData.total) : '-'}</div>
                        <div>
                          <Badge variant={statusConfig[r.status].variant}>
                            {statusConfig[r.status].label}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {r.extractedData ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {r.draftJournalEntryId ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                        </div>
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100">
                          <button className="p-1 text-muted-foreground hover:text-primary" title="View"><Eye className="h-4 w-4" /></button>
                          <button className="p-1 text-muted-foreground hover:text-primary" title="Process"><FileText className="h-4 w-4" /></button>
                          <button className="p-1 text-muted-foreground hover:text-primary" title="Approve"><CheckCircle className="h-4 w-4" /></button>
                          <button className="p-1 text-muted-foreground hover:text-destructive" title="Reject"><XCircle className="h-4 w-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
                  <h3 className="font-medium">Optional Details</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="vendor">Vendor (optional)</Label>
                      <Input id="vendor" placeholder="Vendor name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Date (optional)</Label>
                      <Input id="date" type="date" />
                    </div>
                  </div>
                  <Button className="w-full sm:w-auto" disabled>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Process
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Uploads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <div className="grid grid-cols-[120px_1fr_100px_100px_100px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                    <div>Date</div>
                    <div>File</div>
                    <div>Status</div>
                    <div>Progress</div>
                    <div className="text-right">Actions</div>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {sampleReceipts.slice(0, 3).map(r => (
                      <div key={r.id} className="grid grid-cols-[120px_1fr_100px_100px_100px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                        <div className="text-sm">{formatDate(r.createdAt)}</div>
                        <div className="font-medium truncate">{r.vendor || 'receipt.jpg'}</div>
                        <div><Badge variant={statusConfig[r.status].variant}>{statusConfig[r.status].label}</Badge></div>
                        <div className="text-sm text-muted-foreground">Complete</div>
                        <div className="flex items-center gap-1 justify-end">
                          <button className="p-1 text-muted-foreground hover:text-primary" title="View"><Eye className="h-4 w-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}