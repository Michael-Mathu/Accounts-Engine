'use client';

import { useState } from 'react';
import { Plus, Search, ChevronDown, ChevronRight, Eye, Edit, Archive, Download, Calculator, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function TaxPage() {
  const [activeTab, setActiveTab] = useState<'schedule-c' | 'mileage' | 'fixed-assets'>('schedule-c');
  const [search, setSearch] = useState('');

  const scheduleCQuery = trpc.tax.getScheduleCLines.useQuery();
  const mileageQuery = trpc.tax.listMileageLogs.useQuery();

  const scheduleCLines = scheduleCQuery.data || [];
  const mileageLogs = mileageQuery.data || [];

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
                {scheduleCQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <div className="grid grid-cols-[1fr_80px_1fr_100px_80px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                      <div>Line</div>
                      <div>Part</div>
                      <div>Label</div>
                      <div>Limit</div>
                      <div className="text-right">Actions</div>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto">
                      {scheduleCLines
                        .filter(line => line.description?.toLowerCase().includes(search.toLowerCase()))
                        .map(line => (
                          <div key={line.id} className="grid grid-cols-[1fr_80px_1fr_100px_80px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                            <div className="font-mono text-sm font-medium">{line.lineNumber}</div>
                            <div className="text-sm text-muted-foreground">{line.part}</div>
                            <div className="font-medium">{line.description}</div>
                            <div className="text-sm text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {line.isDeductible ? 'Deductible' : 'Non-deductible'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 justify-end">
                              <button className="p-1 text-muted-foreground hover:text-primary" title="Edit mapping"><Edit className="h-4 w-4" /></button>
                            </div>
                          </div>
                        ))}
                      {scheduleCLines.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground">No Schedule C lines configured</div>
                      )}
                    </div>
                  </div>
                )}
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
                  {mileageQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
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
                        {mileageLogs.map(log => (
                          <div key={log.id} className="grid grid-cols-[120px_150px_1fr_100px_100px_100px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                            <div className="text-sm">{formatDate(log.logDate)}</div>
                            <div className="font-medium">{log.businessPurpose}</div>
                            <div className="text-sm text-muted-foreground">{log.startLocation} → {log.endLocation}</div>
                            <div className="text-right text-sm">{Number(log.miles) || 0} mi</div>
                            <div className="text-right text-sm">${log.rateUsed || 0.67}/mi</div>
                            <div className="text-right font-medium">{formatCurrency(Number(log.miles) * Number(log.rateUsed || 0.67))}</div>
                          </div>
                        ))}
                        {mileageLogs.length === 0 && (
                          <div className="p-8 text-center text-muted-foreground">No mileage logs found</div>
                        )}
                      </div>
                    </div>
                  )}
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
                  <a href="/dashboard/fixed-assets/new">
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
                  <p className="text-muted-foreground">View and manage fixed assets at <a href="/dashboard/fixed-assets" className="text-primary underline">/dashboard/fixed-assets</a></p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}