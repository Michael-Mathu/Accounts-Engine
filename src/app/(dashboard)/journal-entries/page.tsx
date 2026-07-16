'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Eye, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { formatDate } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function JournalEntriesListPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = trpc.journalEntries.list.useQuery({
    page,
    pageSize: 25,
    search: search || undefined,
    isPosted: status === 'posted' ? true : status === 'draft' ? false : undefined,
  });

  const entries = data?.entries || [];
  const pagination = data?.pagination;

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= (pagination?.totalPages || 1)) {
      setPage(newPage);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Journal Entries</h1>
            <p className="text-muted-foreground">
              View and manage your journal entries
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/journal-entries/new">
              <Plus className="mr-2 h-4 w-4" />
              New Entry
            </Link>
          </Button>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Failed to load entries: {error.message}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Entries</CardTitle>
            <div className="flex items-center gap-4">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="border rounded px-3 py-2 text-sm bg-background"
              >
                <option value="all">All Status</option>
                <option value="posted">Posted</option>
                <option value="draft">Draft</option>
              </select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search entries..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-[250px]"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading entries...</p>
                </div>
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No journal entries found.</p>
                <Button asChild variant="link" className="mt-2">
                  <Link href="/dashboard/journal-entries/new">Create your first entry</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <div className="grid grid-cols-[120px_120px_80px_120px_1fr_80px_80px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                    <div>Date</div>
                    <div>Reference</div>
                    <div>Journal</div>
                    <div>Period</div>
                    <div>Description</div>
                    <div>Status</div>
                    <div className="text-right pr-3">Actions</div>
                  </div>
                  <div className="max-h-[600px] overflow-y-auto">
                    {entries.map((entry) => (
                      <div key={entry.id} className="grid grid-cols-[120px_120px_80px_120px_1fr_80px_80px] gap-4 p-3 border-b last:border-b-0 items-center text-sm">
                        <div>{formatDate(entry.postingDate || entry.entryDate)}</div>
                        <div className="font-mono">{entry.referenceNumber || '—'}</div>
                        <div>{entry.journalCode}</div>
                        <div>{entry.periodName}</div>
                        <div className="truncate">{entry.description || '—'}</div>
                        <div>
                          {entry.isPosted ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">Posted</Badge>
                          ) : (
                            <Badge variant="secondary">Draft</Badge>
                          )}
                        </div>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild title="View">
                            <Link href={`/dashboard/journal-entries/${entry.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          {!entry.isPosted && (
                            <Button variant="ghost" size="icon" asChild title="Edit">
                              <Link href={`/dashboard/journal-entries/${entry.id}/edit`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(page - 1)}
                        disabled={page <= 1}
                      >
                        ‹
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(page + 1)}
                        disabled={page >= pagination.totalPages}
                      >
                        ›
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}