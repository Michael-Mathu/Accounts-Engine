'use client';

import { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Eye, Edit, Archive, Upload, Download, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

interface BankAccount {
  id: string;
  name: string;
  ledgerAccountName: string;
  plaidItemId: string | null;
  currency: string;
}

interface BankTransaction {
  id: string;
  bankAccountName: string;
  externalTransactionId: string | null;
  postedDate: string;
  amount: number;
  description: string;
  status: 'unmatched' | 'matched' | 'excluded';
  matchType: string | null;
}

const sampleBankAccounts: BankAccount[] = [
  { id: '1', name: 'Operating Checking', ledgerAccountName: 'Cash - Checking', plaidItemId: 'plaid_123', currency: 'USD' },
  { id: '2', name: 'Savings Account', ledgerAccountName: 'Cash - Savings', plaidItemId: 'plaid_456', currency: 'USD' },
  { id: '3', name: 'Business Credit Card', ledgerAccountName: 'Credit Card Payable', plaidItemId: 'plaid_789', currency: 'USD' },
];

const sampleTransactions: BankTransaction[] = [
  { id: '1', bankAccountName: 'Operating Checking', externalTransactionId: 'txn_123', postedDate: '2024-03-15', amount: -2500, description: 'Office Supplies Plus', status: 'matched', matchType: 'exact' },
  { id: '2', bankAccountName: 'Operating Checking', externalTransactionId: 'txn_124', postedDate: '2024-03-14', amount: -1200, description: 'Tech Hardware Inc', status: 'matched', matchType: 'rule' },
  { id: '3', bankAccountName: 'Operating Checking', externalTransactionId: 'txn_125', postedDate: '2024-03-13', amount: 15000, description: 'Acme Corp Payment', status: 'matched', matchType: 'exact' },
  { id: '4', bankAccountName: 'Operating Checking', externalTransactionId: 'txn_126', postedDate: '2024-03-12', amount: -4500, description: 'Rent Payment', status: 'unmatched', matchType: null },
  { id: '5', bankAccountName: 'Savings Account', externalTransactionId: 'txn_127', postedDate: '2024-03-11', amount: 500, description: 'Interest Deposit', status: 'unmatched', matchType: null },
];

const sampleRules: { id: string; matchPattern: string; targetAccountName: string; priority: number }[] = [
  { id: '1', matchPattern: 'OFFICE SUPPLIES', targetAccountName: 'Office Supplies', priority: 10 },
  { id: '2', matchPattern: 'RENT', targetAccountName: 'Rent Expense', priority: 20 },
  { id: '3', matchPattern: 'UTILITIES', targetAccountName: 'Utilities Expense', priority: 30 },
];

export default function BankingPage() {
  const [activeTab, setActiveTab] = useState<'accounts' | 'transactions' | 'reconciliation' | 'rules'>('accounts');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unmatched' | 'matched' | 'excluded'>('all');

  const tabs = [
    { value: 'accounts', label: 'Bank Accounts' },
    { value: 'transactions', label: 'Transactions' },
    { value: 'reconciliation', label: 'Reconciliation' },
    { value: 'rules', label: 'Rules' },
  ];

  const filteredTransactions = sampleTransactions.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && 
        !t.externalTransactionId?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
              <a href="/dashboard/banking/import">
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </a>
            </Button>
            <Button asChild>
              <a href="/dashboard/banking/accounts/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </a>
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab as (value: string) => void} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            {tabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="accounts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Bank Accounts</CardTitle>
                <Button asChild>
                  <a href="/dashboard/banking/accounts/new">Add Account</a>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <div className="grid grid-cols-[1fr_1fr_120px_100px_120px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                    <div>Name</div>
                    <div>Ledger Account</div>
                    <div>Plaid Status</div>
                    <div>Currency</div>
                    <div className="text-right">Actions</div>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {sampleBankAccounts.map(account => (
                      <div key={account.id} className="grid grid-cols-[1fr_1fr_120px_100px_120px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                        <div className="font-medium">{account.name}</div>
                        <div className="text-sm text-muted-foreground">{account.ledgerAccountName}</div>
                        <div>
                          <Badge variant={account.plaidItemId ? 'default' : 'outline'}>
                            {account.plaidItemId ? 'Connected' : 'Manual'}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{account.currency}</div>
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100">
                          <button className="p-1 text-muted-foreground hover:text-primary" title="Sync"><RefreshCw className="h-4 w-4" /></button>
                          <button className="p-1 text-muted-foreground hover:text-primary" title="View"><ExternalLink className="h-4 w-4" /></button>
                          <button className="p-1 text-muted-foreground hover:text-primary" title="Edit"><Edit className="h-4 w-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Bank Transactions</CardTitle>
                <Button variant="outline" asChild>
                  <a href="/dashboard/banking/import">
                    <Upload className="mr-2 h-4 w-4" />
                    Import CSV/OFX
                  </a>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <div className="flex flex-col sm:flex-row gap-4 p-3 bg-muted/50 border-b">
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
                  <div className="grid grid-cols-[120px_1fr_100px_120px_100px_100px_100px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                    <div>Date</div>
                    <div>Account</div>
                    <div>Description</div>
                    <div className="text-right">Amount</div>
                    <div>Status</div>
                    <div>Match Type</div>
                    <div className="text-right">Actions</div>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto">
                    {sampleTransactions.map(t => (
                      <div key={t.id} className="grid grid-cols-[120px_1fr_100px_120px_100px_100px_100px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                        <div className="text-sm">{formatDate(t.postedDate)}</div>
                        <div className="text-sm text-muted-foreground">{t.bankAccountName}</div>
                        <div className="font-medium">{t.description}</div>
                        <div className={`text-right font-medium ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(t.amount)}</div>
                        <div>
                          <Badge variant={t.status === 'matched' ? 'default' : t.status === 'excluded' ? 'destructive' : 'outline'}>
                            {t.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{t.matchType || '-'}</div>
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100">
                          <button className="p-1 text-muted-foreground hover:text-primary" title="Match"><AlertTriangle className="h-4 w-4" /></button>
                          <button className="p-1 text-muted-foreground hover:text-primary" title="Exclude"><Archive className="h-4 w-4" /></button>
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
  )
}