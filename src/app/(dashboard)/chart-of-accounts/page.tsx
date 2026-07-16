'use client';

import { useState } from 'react';
import { Plus, Search, ChevronDown, ChevronRight, Eye, Edit, Archive, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

interface Account {
  id: string;
  code: string;
  name: string;
  description?: string;
  accountTypeId: number;
  accountTypeName?: string;
  accountClass: string;
  normalBalance: 'debit' | 'credit';
  parentId?: string;
  isActive: boolean;
  scheduleCLineId?: string;
  children?: Account[];
}

const sampleAccounts: Account[] = [
  {
    id: '1', code: '1000', name: 'Assets', description: '', accountTypeId: 1,
    accountTypeName: 'Asset', accountClass: 'asset', normalBalance: 'debit',
    isActive: true, children: [
      { id: '2', code: '1110', name: 'Cash', description: 'Checking and savings', accountTypeId: 1, accountTypeName: 'Asset', accountClass: 'asset', normalBalance: 'debit', isActive: true, parentId: '1' },
      { id: '3', code: '1120', name: 'Accounts Receivable', description: 'Customer invoices', accountTypeId: 1, accountTypeName: 'Asset', accountClass: 'asset', normalBalance: 'debit', isActive: true, parentId: '1' },
      { id: '4', code: '1130', name: 'Inventory', description: 'Goods for sale', accountTypeId: 1, accountTypeName: 'Asset', accountClass: 'asset', normalBalance: 'debit', isActive: true, parentId: '1' },
      { id: '5', code: '1210', name: 'Equipment', description: 'Office equipment', accountTypeId: 1, accountTypeName: 'Asset', accountClass: 'asset', normalBalance: 'debit', isActive: true, parentId: '1' },
    ]
  },
  {
    id: '6', code: '2000', name: 'Liabilities', description: '', accountTypeId: 2,
    accountTypeName: 'Liability', accountClass: 'liability', normalBalance: 'credit',
    isActive: true, children: [
      { id: '7', code: '2110', name: 'Accounts Payable', description: 'Vendor bills', accountTypeId: 2, accountTypeName: 'Liability', accountClass: 'liability', normalBalance: 'credit', isActive: true, parentId: '6' },
      { id: '8', code: '2120', name: 'Credit Card', description: 'Business credit card', accountTypeId: 2, accountTypeName: 'Liability', accountClass: 'liability', normalBalance: 'credit', isActive: true, parentId: '6' },
    ]
  },
  {
    id: '9', code: '3000', name: 'Equity', description: '', accountTypeId: 3,
    accountTypeName: 'Equity', accountClass: 'equity', normalBalance: 'credit',
    isActive: true, children: [
      { id: '10', code: '3100', name: 'Owner\'s Capital', description: '', accountTypeId: 3, accountTypeName: 'Equity', accountClass: 'equity', normalBalance: 'credit', isActive: true, parentId: '9' },
      { id: '11', code: '3200', name: 'Retained Earnings', description: '', accountTypeId: 3, accountTypeName: 'Equity', accountClass: 'equity', normalBalance: 'credit', isActive: true, parentId: '9' },
    ]
  },
  {
    id: '12', code: '4000', name: 'Revenue', description: '', accountTypeId: 4,
    accountTypeName: 'Revenue', accountClass: 'revenue', normalBalance: 'credit',
    isActive: true, children: [
      { id: '13', code: '4100', name: 'Sales Revenue', description: '', accountTypeId: 4, accountTypeName: 'Revenue', accountClass: 'revenue', normalBalance: 'credit', isActive: true, parentId: '12' },
      { id: '14', code: '4200', name: 'Service Revenue', description: '', accountTypeId: 4, accountTypeName: 'Revenue', accountClass: 'revenue', normalBalance: 'credit', isActive: true, parentId: '12' },
    ]
  },
  {
    id: '15', code: '5000', name: 'Expenses', description: '', accountTypeId: 5,
    accountTypeName: 'Expense', accountClass: 'expense', normalBalance: 'debit',
    isActive: true, children: [
      { id: '16', code: '5100', name: 'Cost of Goods Sold', description: '', accountTypeId: 5, accountTypeName: 'Expense', accountClass: 'expense', normalBalance: 'debit', isActive: true, parentId: '15' },
      { id: '17', code: '5200', name: 'Payroll Expenses', description: '', accountTypeId: 5, accountTypeName: 'Expense', accountClass: 'expense', normalBalance: 'debit', isActive: true, parentId: '15' },
      { id: '18', code: '5300', name: 'Rent Expense', description: '', accountTypeId: 5, accountTypeName: 'Expense', accountClass: 'expense', normalBalance: 'debit', isActive: true, parentId: '15' },
    ]
  },
];

export default function ChartOfAccountsPage() {
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterActive, setFilterActive] = useState(true);
  const [expandedAccounts, setExpandedAccounts] = useState<string[]>(['1', '6', '9', '12', '15']);
  const [showInactive, setShowInactive] = useState(false);

  const toggleExpand = (accountId: string) => {
    setExpandedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const filteredAccounts = sampleAccounts.filter(account => {
    if (!showInactive && !account.isActive) return false;
    if (filterActive && !account.isActive) return false;
    if (filterClass !== 'all' && account.accountClass !== filterClass) return false;
    if (search && !account.name.toLowerCase().includes(search.toLowerCase()) && 
        !account.code.includes(search)) return false;
    return true;
  });

  const renderAccountTree = (accounts: Account[], level = 0) => (
    <div className="space-y-1">
      {accounts.map(account => (
        <div key={account.id} className="group">
          <div className={`flex items-center gap-2 py-2 px-2 rounded transition-colors ${level > 0 ? 'pl-8' : ''} ${!account.isActive ? 'opacity-50' : ''}`}>
            {account.children && account.children.length > 0 ? (
              <button
                onClick={() => toggleExpand(account.id)}
                className="p-1 text-muted-foreground hover:text-foreground"
                aria-expanded={expandedAccounts.includes(account.id)}
              >
                {expandedAccounts.includes(account.id) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-8" />
            )}
            <span className="font-mono text-sm font-medium w-20">{account.code}</span>
            <span className="flex-1 text-sm font-medium">{account.name}</span>
            <span className="text-xs text-muted-foreground hidden sm:block w-32">
              {account.accountTypeName}
            </span>
            <Badge variant="outline" className={`text-xs ${account.normalBalance === 'debit' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
              {account.normalBalance === 'debit' ? 'Dr' : 'Cr'}
            </Badge>
            {account.isActive ? (
              <Badge variant="default" className="text-xs">Active</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Archived</Badge>
            )}
            <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100">
              <button className="p-1 text-muted-foreground hover:text-primary" title="View">
                <Eye className="h-4 w-4" />
              </button>
              <button className="p-1 text-muted-foreground hover:text-primary" title="Edit">
                <Edit className="h-4 w-4" />
              </button>
              <button className="p-1 text-muted-foreground hover:text-destructive" title="Archive">
                <Archive className="h-4 w-4" />
              </button>
            </div>
          </div>
          {expandedAccounts.includes(account.id) && account.children && (
            <div>{renderAccountTree(account.children, level + 1)}</div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
            <p className="text-muted-foreground">
              Manage your chart of accounts hierarchy
            </p>
          </div>
          <Button asChild>
            <a href="/dashboard/chart-of-accounts/new">New Account</a>
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Accounts</CardTitle>
            <div className="flex items-center gap-4">
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="asset">Assets</SelectItem>
                  <SelectItem value="liability">Liabilities</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="expense">Expenses</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Search accounts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[250px]"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <div className="grid grid-cols-[20px_80px_1fr_100px_80px_80px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                <div></div>
                <div>Code</div>
                <div>Name</div>
                <div>Type</div>
                <div>Normal</div>
                <div>Status</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {renderAccountTree(filteredAccounts)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}