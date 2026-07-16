'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function BankingPage() {
  const [activeTab, setActiveTab] = useState<'accounts' | 'transactions' | 'reconciliation' | 'rules'>('accounts');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unmatched' | 'matched' | 'excluded'>('all');

  const { data: bankAccountsData, isLoading: accountsLoading, error: accountsError } = trpc.bankAccounts.list.useQuery();
  const { data: transactionsData, isLoading: transactionsLoading, error: transactionsError } = trpc.bankTransactions.list.useQuery({
    status: filterStatus === 'all' ? undefined : filterStatus,
  });

  const bankAccounts = bankAccountsData || [];
  const transactions = transactionsData?.transactions || [];

  const isLoading = accountsLoading || transactionsLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Banking</h1>
            <p className="text-muted-foreground">Bank accounts, transactions, and reconciliation</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/banking/import">
                Import CSV/OFX
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/banking/accounts/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Link>
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab as (value: string) => void} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="accounts">Bank Accounts</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts">
            {isLoading ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center">Loading bank accounts...</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Bank Accounts</CardTitle>
                </CardHeader>
                <CardContent>
                  {bankAccounts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No bank accounts configured.</p>
                      <Button asChild variant="link" className="mt-2">
                        <Link href="/dashboard/banking/accounts/new">Add your first bank account</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <div className="grid grid-cols-[1fr_1fr_120px_100px_120px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                        <div>Name</div>
                        <div>Ledger Account</div>
                        <div>Plaid Status</div>
                        <div>Currency</div>
                        <div className="text-right">Actions</div>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        {bankAccounts.map(account => (
                          <div key={account.id} className="grid grid-cols-[1fr_1fr_120px_100px_120px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                            <div className="font-medium">{account.name}</div>
                            <div className="text-sm text-muted-foreground">{account.ledgerAccountCode} - {account.ledgerAccountName}</div>
                            <div>
                              <Badge variant={account.plaidItemId ? 'default' : 'outline'}>
                                {account.plaidItemId ? 'Connected' : 'Manual'}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">{account.currency}</div>
                            <div className="flex items-center gap-1 justify-end">
                              <Button variant="ghost" size="icon" asChild title="Sync">
                                <Link href={`/dashboard/banking/accounts/${account.id}`}>
                                  <RefreshCw className="h-4 w-4" />
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
            )}
          </TabsContent>

          <TabsContent value="transactions">
            {isLoading ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center">Loading transactions...</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Bank Transactions</CardTitle>
                  <div className="flex items-center gap-4">
                    <Select value={filterStatus} onValueChange={setFilterStatus as (value: string) => void}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="unmatched">Unmatched</SelectItem>
                        <SelectItem value="matched">Matched</SelectItem>
                        <SelectItem value="excluded">Excluded</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} className="w-[250px]" />
                  </div>
                </CardHeader>
                <CardContent>
                  {transactions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No transactions found.</p>
                      <Button asChild variant="link" className="mt-2">
                        <Link href="/dashboard/banking/import">Import transactions</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <div className="grid grid-cols-[120px_1fr_100px_120px_100px_100px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                        <div>Date</div>
                        <div>Account</div>
                        <div>Description</div>
                        <div className="text-right">Amount</div>
                        <div>Status</div>
                        <div className="text-right">Actions</div>
                      </div>
                      <div className="max-h-[500px] overflow-y-auto">
                        {transactions
                          .filter(t => !search || t.description?.toLowerCase().includes(search.toLowerCase()))
                          .map(t => (
                            <div key={t.id} className="grid grid-cols-[120px_1fr_100px_120px_100px_100px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                              <div className="text-sm">{formatDate(t.postedDate)}</div>
                              <div className="text-sm text-muted-foreground">{t.bankAccountName}</div>
                              <div className="font-medium">{t.description}</div>
                              <div className={`text-right font-medium ${Number(t.amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(Number(t.amount))}
                              </div>
                              <div>
                                <Badge variant={t.status === 'matched' ? 'default' : t.status === 'excluded' ? 'destructive' : 'outline'}>
                                  {t.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 justify-end">
                                {t.status === 'unmatched' && (
                                  <Button variant="ghost" size="icon" asChild title="Match">
                                    <Link href={`/dashboard/banking/transactions/${t.id}/match`}>
                                      <ExternalLink className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}