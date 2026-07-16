'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

interface Account {
  id: string;
  code: string;
  name: string;
  description: string | null;
  accountTypeId: number;
  parentId: string | null;
  isActive: boolean;
  accountClass: string;
  normalBalance: string;
  children?: Account[];
  accountTypeName?: string;
}

interface AccountsTreeProps {
  accounts: Account[];
  onSelect?: (account: Account) => void;
}

function AccountTreeNode({ 
  account, 
  level = 0, 
  onSelect,
  expandedAccounts,
  toggleExpand 
}: {
  account: Account;
  level: number;
  onSelect?: (account: Account) => void;
  expandedAccounts: Set<string>;
  toggleExpand: (id: string) => void;
}) {
  const isExpanded = expandedAccounts.has(account.id);
  const hasChildren = account.children && account.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded transition-colors',
          'hover:bg-accent cursor-pointer',
          onSelect && 'border-l-2 border-primary',
          level > 0 && 'ml-6'
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) {
            toggleExpand(account.id);
          } else if (onSelect) {
            onSelect(account);
          }
        }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(account.id);
            }}
className={cn(
              'p-1 rounded transition-colors',
              isExpanded && 'rotate-90'
            )}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
        {!hasChildren && <div className="w-6" />}
        
        <span className="font-mono text-sm font-medium text-muted-foreground mr-2">
          {account.code}
        </span>
        <span className="font-medium flex-1 truncate">{account.name}</span>
        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
          {account.accountClass}
        </span>
        <span className="text-xs text-muted-foreground font-mono">
          {account.normalBalance === 'debit' ? 'Dr' : 'Cr'}
        </span>
      </div>
      
      {isExpanded && account.children && (
        <div className="border-l border-muted/50 ml-2">
          {account.children.map((child) => (
            <AccountTreeNode
              key={child.id}
              account={child}
              level={level + 1}
              onSelect={onSelect}
              expandedAccounts={expandedAccounts}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AccountsTree({ accounts, onSelect }: AccountsTreeProps) {
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Build tree from flat list
  const buildTree = (accounts: Account[]): Account[] => {
    const accountMap = new Map<string, Account>();
    const roots: Account[] = [];

    accounts.forEach(acc => {
      accountMap.set(acc.id, { ...acc, children: [] });
    });

    accounts.forEach(acc => {
      const node = accountMap.get(acc.id)!;
      if (acc.parentId && accountMap.has(acc.parentId)) {
        const parent = accountMap.get(acc.parentId)!;
        parent.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const tree = buildTree(accounts);

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <Button asChild>
          <a href="/dashboard/chart-of-accounts/new">New Account</a>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-muted/50">
{tree.map((account) => (
               <AccountTreeNode
                 key={account.id}
                 account={account}
                 level={0}
                 onSelect={onSelect}
                 expandedAccounts={expandedAccounts}
                 toggleExpand={toggleExpand}
               />
             ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}