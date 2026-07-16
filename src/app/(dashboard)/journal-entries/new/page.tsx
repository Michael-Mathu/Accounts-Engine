'use client';

import { useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';

interface JournalLine {
  id: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  description: string;
  debit: number;
  credit: number;
}

interface Account {
  id: string;
  code: string;
  name: string;
  normalBalance: 'debit' | 'credit';
}

export default function JournalEntriesPage() {
  const [lines, setLines] = useState<JournalLine[]>([
    { id: '1', accountId: '', description: '', debit: 0, credit: 0 },
    { id: '2', accountId: '', description: '', debit: 0, credit: 0 },
  ]);
  const [entryDate, setEntryDate] = useState('');
  const [postingDate, setPostingDate] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [journalId, setJournalId] = useState('1');
  const [accountingPeriodId, setAccountingPeriodId] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sample accounts - in production would come from tRPC
  const accounts: Account[] = [
    { id: '1', code: '1110', name: 'Cash', normalBalance: 'debit' },
    { id: '2', code: '1120', name: 'Accounts Receivable', normalBalance: 'debit' },
    { id: '3', code: '1130', name: 'Inventory', normalBalance: 'debit' },
    { id: '4', code: '1210', name: 'Equipment', normalBalance: 'debit' },
    { id: '5', code: '2110', name: 'Accounts Payable', normalBalance: 'credit' },
    { id: '6', code: '3100', name: 'Owner\'s Capital', normalBalance: 'credit' },
    { id: '7', code: '4100', name: 'Sales Revenue', normalBalance: 'credit' },
    { id: '8', code: '5100', name: 'Cost of Goods Sold', normalBalance: 'debit' },
    { id: '9', code: '5200', name: 'Payroll Expenses', normalBalance: 'debit' },
    { id: '10', code: '5300', name: 'Rent Expense', normalBalance: 'debit' },
  ];

  const totalDebits = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredits = lines.reduce((sum, line) => sum + line.credit, 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;
  const hasMinLines = lines.length >= 2;

const updateLine = (id: string, field: keyof JournalLine, value: string | number) => {
     setLines(prev => prev.map(line => 
       line.id === id ? { ...line, [field]: value } : line
     ));
     setError(null);
   };

  const addLine = () => {
    const newId = Date.now().toString();
    setLines(prev => [...prev, { 
      id: newId, 
      accountId: '', 
      description: '', 
      debit: 0, 
      credit: 0 
    }]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 2) {
      setError('A journal entry must have at least 2 lines');
      return;
    }
    setLines(prev => prev.filter(line => line.id !== id));
  };

  const handleSubmit = async (post: boolean) => {
    setError(null);
    
    if (!hasMinLines) {
      setError('A journal entry must have at least 2 lines');
      return;
    }
    
    if (!isBalanced) {
      setError(`Entry is not balanced: Debits ${formatCurrency(totalDebits)} ≠ Credits ${formatCurrency(totalCredits)}`);
      return;
    }

    // Check all lines have accounts
    const missingAccounts = lines.some(l => !l.accountId);
    if (missingAccounts) {
      setError('All lines must have an account selected');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // In production, call tRPC mutation
      // await trpc.journalEntries.createDraft.mutate({...})
      
      console.log('Submitting journal entry:', {
        journalId,
        accountingPeriodId,
        entryDate,
        postingDate,
        referenceNumber,
        description,
        isPosted: post,
        lines: lines.map(l => ({
          accountId: l.accountId,
          description: l.description,
          debit: l.debit,
          credit: l.credit,
        })),
      });
      
      alert(post ? 'Journal entry posted successfully!' : 'Draft saved successfully!');
    } catch {
      setError('Failed to save journal entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Journal Entry</h1>
          <p className="text-muted-foreground">
            Create a new journal entry with live balance validation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.href = '/dashboard/journal-entries'}>
            Back to List
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Entry Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="entryDate">Entry Date</Label>
                  <Input
                    id="entryDate"
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postingDate">Posting Date</Label>
                  <Input
                    id="postingDate"
                    type="date"
                    value={postingDate}
                    onChange={(e) => setPostingDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="journalId">Journal</Label>
                  <Select value={journalId} onValueChange={setJournalId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select journal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">General Journal (GJ)</SelectItem>
                      <SelectItem value="2">Sales Journal (SJ)</SelectItem>
                      <SelectItem value="3">Purchase Journal (PJ)</SelectItem>
                      <SelectItem value="4">Cash Receipts (CR)</SelectItem>
                      <SelectItem value="5">Cash Disbursements (CD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountingPeriodId">Accounting Period</Label>
                  <Select value={accountingPeriodId} onValueChange={setAccountingPeriodId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">January 2024 (Open)</SelectItem>
                      <SelectItem value="2">February 2024 (Open)</SelectItem>
                      <SelectItem value="3" disabled>March 2024 (Closed)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="referenceNumber">Reference Number</Label>
                  <Input
                    id="referenceNumber"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Optional reference"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Entry description"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Journal Lines</CardTitle>
              <span className={isBalanced ? 'text-green-600' : 'text-destructive'}>
                {isBalanced ? '✓ Balanced' : '✗ Not Balanced'}
              </span>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-4 p-2 bg-muted/50 rounded text-sm font-medium">
                  <div className="col-span-4">Account</div>
                  <div className="col-span-3">Description</div>
                  <div className="col-span-2 text-right">Debit</div>
                  <div className="col-span-2 text-right">Credit</div>
                  <div className="col-span-1"></div>
                </div>
                
                {lines.map((line) => (
                  <div key={line.id} className="grid grid-cols-12 gap-4 items-center p-2 border-b last:border-b-0">
                    <div className="col-span-4">
                      <Select value={line.accountId} onValueChange={(v) => updateLine(line.id, 'accountId', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name} ({acc.normalBalance === 'debit' ? 'Dr' : 'Cr'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input
                        placeholder="Line description"
                        value={line.description}
                        onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={line.debit || ''}
                        onChange={(e) => updateLine(line.id, 'debit', parseFloat(e.target.value) || 0)}
                        className="text-right"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={line.credit || ''}
                        onChange={(e) => updateLine(line.id, 'credit', parseFloat(e.target.value) || 0)}
                        className="text-right"
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length <= 2}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                <div className="grid grid-cols-12 gap-4 p-2 bg-muted/50 font-medium">
                  <div className="col-span-7 text-right">Totals:</div>
                  <div className="col-span-2 text-right">{formatCurrency(totalDebits)}</div>
                  <div className="col-span-2 text-right">{formatCurrency(totalCredits)}</div>
                  <div className="col-span-1"></div>
                </div>
              </div>
              
              <Button onClick={addLine} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Balance Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Total Debits</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(totalDebits)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Credits</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(totalCredits)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Difference</p>
                  <p className={`text-2xl font-bold ${isBalanced ? 'text-green-600' : 'text-destructive'}`}>
                    {formatCurrency(Math.abs(totalDebits - totalCredits))}
                    {isBalanced ? ' ✓' : ' ✗'}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-muted-foreground border-t pt-4">
                <p>Lines: {lines.length} {hasMinLines ? '(min 2 ✓)' : '(min 2 required ✗)'}</p>
                <p>Status: {isBalanced && hasMinLines ? 'Ready to post' : 'Fix errors before posting'}</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button 
              variant="outline" 
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save as Draft'}
            </Button>
            <Button 
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting || !isBalanced || !hasMinLines}
              className="flex-1"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Post Entry'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}