'use client';

import { useState } from 'react';
import { Plus, Search, ChevronDown, ChevronRight, Eye, Edit, Archive, Download, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

interface ScheduleCLine {
  id: string;
  part: number;
  lineNumber: string;
  label: string;
  deductibilityLimit: number;
  isStandard: boolean;
}

interface MileageLog {
  id: string;
  logDate: string;
  startLocation: string;
  endLocation: string;
  businessPurpose: string;
  miles: number;
  rateUsed: number;
  deductibleAmount: number;
}

interface FixedAsset {
  id: string;
  name: string;
  purchaseDate: string;
  cost: number;
  salvageValue: number;
  usefulLifeYears: number;
  method: string;
  assetAccountName: string;
  accumulatedDepreciationAccountName: string;
}

const sampleScheduleCLines: ScheduleCLine[] = [
  { id: '1', part: 1, lineNumber: '1', label: 'Gross receipts or sales', deductibilityLimit: 1, isStandard: true },
  { id: '2', part: 1, lineNumber: '2', label: 'Returns and allowances', deductibilityLimit: 1, isStandard: true },
  { id: '3', part: 1, lineNumber: '4', label: 'Cost of goods sold', deductibilityLimit: 1, isStandard: true },
  { id: '4', part: 2, lineNumber: '8', label: 'Advertising', deductibilityLimit: 1, isStandard: true },
  { id: '5', part: 2, lineNumber: '9', label: 'Car and truck expenses', deductibilityLimit: 1, isStandard: true },
  { id: '6', part: 2, lineNumber: '10', label: 'Commissions and fees', deductibilityLimit: 1, isStandard: true },
  { id: '7', part: 2, lineNumber: '11', label: 'Contract labor', deductibilityLimit: 1, isStandard: true },
  { id: '8', part: 2, lineNumber: '12', label: 'Depletion', deductibilityLimit: 1, isStandard: true },
  { id: '9', part: 2, lineNumber: '13', label: 'Depreciation', deductibilityLimit: 1, isStandard: true },
  { id: '10', part: 2, lineNumber: '14', label: 'Employee benefit programs', deductibilityLimit: 1, isStandard: true },
  { id: '11', part: 2, lineNumber: '15', label: 'Insurance', deductibilityLimit: 1, isStandard: true },
  { id: '12', part: 2, lineNumber: '16', label: 'Interest', deductibilityLimit: 1, isStandard: true },
  { id: '13', part: 2, lineNumber: '17', label: 'Legal and professional services', deductibilityLimit: 1, isStandard: true },
  { id: '14', part: 2, lineNumber: '18', label: 'Office expenses', deductibilityLimit: 1, isStandard: true },
  { id: '15', part: 2, lineNumber: '19', label: 'Pension and profit-sharing plans', deductibilityLimit: 1, isStandard: true },
  { id: '16', part: 2, lineNumber: '20', label: 'Rent or lease', deductibilityLimit: 1, isStandard: true },
  { id: '17', part: 2, lineNumber: '21', label: 'Repairs and maintenance', deductibilityLimit: 1, isStandard: true },
  { id: '18', part: 2, lineNumber: '22', label: 'Supplies', deductibilityLimit: 1, isStandard: true },
  { id: '19', part: 2, lineNumber: '23', label: 'Taxes and licenses', deductibilityLimit: 1, isStandard: true },
  { id: '20', part: 2, lineNumber: '24', label: 'Travel', deductibilityLimit: 1, isStandard: true },
  { id: '21', part: 2, lineNumber: '24b', label: 'Meals and entertainment (50%)', deductibilityLimit: 0.5, isStandard: true },
  { id: '22', part: 2, lineNumber: '25', label: 'Utilities', deductibilityLimit: 1, isStandard: true },
  { id: '23', part: 2, lineNumber: '26', label: 'Wages', deductibilityLimit: 1, isStandard: true },
];

const sampleMileageLogs: MileageLog[] = [
  { id: '1', logDate: '2024-03-01', startLocation: 'Office', endLocation: 'Client Site A', businessPurpose: 'Client meeting', miles: 25, rateUsed: 0.67, deductibleAmount: 16.75 },
  { id: '2', logDate: '2024-03-05', startLocation: 'Office', endLocation: 'Client Site B', businessPurpose: 'Project review', miles: 18, rateUsed: 0.67, deductibleAmount: 12.06 },
  { id: '3', logDate: '2024-03-10', startLocation: 'Office', endLocation: 'Warehouse', businessPurpose: 'Inventory check', miles: 12, rateUsed: 0.67, deductibleAmount: 8.04 },
];

const sampleFixedAssets: FixedAsset[] = [
  { id: '1', name: 'Office Equipment', purchaseDate: '2024-01-15', cost: 15000, salvageValue: 1500, usefulLifeYears: 5, method: 'straight_line', assetAccountName: 'Equipment', accumulatedDepreciationAccountName: 'Accumulated Depreciation - Equipment' },
  { id: '2', name: 'Delivery Vehicle', purchaseDate: '2023-06-01', cost: 35000, salvageValue: 5000, usefulLifeYears: 5, method: 'straight_line', assetAccountName: 'Vehicles', accumulatedDepreciationAccountName: 'Accumulated Depreciation - Vehicles' },
];

export default function TaxPage() {
  const [activeTab, setActiveTab] = useState<'schedule-c' | 'mileage' | 'fixed-assets'>('schedule-c');
  const [search, setSearch] = useState('');

  const tabs = [
    { value: 'schedule-c', label: 'Schedule C Lines' },
    { value: 'mileage', label: 'Mileage Logs' },
    { value: 'fixed-assets', label: 'Fixed Assets' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tax Center</h1>
            <p className="text-muted-foreground">Schedule C mapping, mileage tracking, and fixed assets</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href="/dashboard/tax/export">
                <Download className="mr-2 h-4 w-4" />
                Export Schedule C
              </a>
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab as (value: string) => void} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            {tabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="schedule-c">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Schedule C Line Mapping</CardTitle>
                <Button asChild>
                  <a href="/dashboard/tax/mapping">Map Accounts</a>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <div className="grid grid-cols-[1fr_80px_1fr_100px_80px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                    <div>Line</div>
                    <div>Part</div>
                    <div>Label</div>
                    <div>Limit</div>
                    <div className="text-right">Actions</div>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto">
                    {sampleScheduleCLines
                      .filter(line => line.label.toLowerCase().includes(search.toLowerCase()))
                      .map(line => (
                        <div key={line.id} className="grid grid-cols-[1fr_80px_1fr_100px_80px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                          <div className="font-mono text-sm font-medium">{line.lineNumber}</div>
                          <div className="text-sm text-muted-foreground">Part {line.part}</div>
                          <div className="font-medium">{line.label}</div>
                          <div className="text-sm text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {Math.round(line.deductibilityLimit * 100)}%
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100">
                            <button className="p-1 text-muted-foreground hover:text-primary" title="Edit mapping"><Edit className="h-4 w-4" /></button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mileage">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Mileage Logs</h2>
                  <p className="text-muted-foreground">Track business mileage for deductions</p>
                </div>
                <Button asChild>
                  <a href="/dashboard/tax/mileage/new">New Mileage Log</a>
                </Button>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Mileage Logs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <div className="grid grid-cols-[120px_150px_1fr_100px_100px_100px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                      <div>Date</div>
                      <div>Purpose</div>
                      <div>Route</div>
                      <div className="text-right">Miles</div>
                      <div className="text-right">Rate</div>
                      <div className="text-right">Deductible</div>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      {sampleMileageLogs.map(log => (
                        <div key={log.id} className="grid grid-cols-[120px_150px_1fr_100px_100px_100px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                          <div className="text-sm">{formatDate(log.logDate)}</div>
                          <div className="font-medium">{log.businessPurpose}</div>
                          <div className="text-sm text-muted-foreground">{log.startLocation} → {log.endLocation}</div>
                          <div className="text-right text-sm">{log.miles} mi</div>
                          <div className="text-right text-sm">${log.rateUsed}/mi</div>
                          <div className="text-right font-medium">{formatCurrency(log.deductibleAmount)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="fixed-assets">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Fixed Assets</h2>
                  <p className="text-muted-foreground">Track fixed assets and depreciation schedules</p>
                </div>
                <Button asChild>
                  <a href="/dashboard/tax/fixed-assets/new">
                    <Plus className="mr-2 h-4 w-4" />
                    New Asset
                  </a>
                </Button>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Fixed Assets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <div className="grid grid-cols-[1fr_120px_100px_100px_100px_100px_120px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                      <div>Name</div>
                      <div>Purchase Date</div>
                      <div className="text-right">Cost</div>
                      <div className="text-right">Salvage</div>
                      <div className="text-right">Life (yrs)</div>
                      <div>Method</div>
                      <div className="text-right">Actions</div>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      {sampleFixedAssets.map(asset => (
                        <div key={asset.id} className="grid grid-cols-[1fr_120px_100px_100px_100px_100px_120px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                          <div className="font-medium">{asset.name}</div>
                          <div className="text-sm text-muted-foreground">{formatDate(asset.purchaseDate)}</div>
                          <div className="text-right font-medium">{formatCurrency(asset.cost)}</div>
                          <div className="text-right text-sm text-muted-foreground">{formatCurrency(asset.salvageValue)}</div>
                          <div className="text-right text-sm">{asset.usefulLifeYears} yrs</div>
                          <div className="text-sm capitalize">{asset.method.replace('_', ' ')}</div>
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100">
                            <button className="p-1 text-muted-foreground hover:text-primary" title="View Schedule"><Calculator className="h-4 w-4" /></button>
                            <button className="p-1 text-muted-foreground hover:text-primary" title="Edit"><Edit className="h-4 w-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}