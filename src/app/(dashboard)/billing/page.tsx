'use client';

import { useState } from 'react';
import { Plus, Search, ChevronDown, ChevronRight, Eye, Edit, Archive, Download, CreditCard, Zap, Shield, Globe, Database, Users, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

interface Subscription {
  id: string;
  plan: 'self_hosted' | 'monthly' | 'quarterly' | 'annual';
  status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'expired';
  stripeCustomerId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

interface CreditBalance {
  creditsRemaining: number;
  transactions: { id: string; amount: number; reason: string; description: string; createdAt: string }[];
}

const mockSubscription: Subscription = {
  id: 'sub_1',
  plan: 'monthly',
  status: 'active',
  stripeCustomerId: 'cus_abc123',
  currentPeriodStart: '2024-03-01',
  currentPeriodEnd: '2024-04-01',
};

const mockCreditBalance = 250;
const mockCreditTransactions = [
  { id: '1', amount: 1000, reason: 'purchase', description: 'Purchased 1000 credits', createdAt: '2024-01-15' },
  { id: '2', amount: -50, reason: 'receipt_ocr', description: 'Receipt OCR extraction', createdAt: '2024-01-20' },
  { id: '3', amount: -25, reason: 'bank_sync', description: 'Bank sync', createdAt: '2024-01-22' },
  { id: '4', amount: -10, reason: 'ai_report', description: 'AI report generation', createdAt: '2024-01-25' },
];

const featureGates = [
  { key: 'plaid_relay', label: 'Plaid Bank Sync', icon: Globe, description: 'Automatic bank transaction import via Plaid' },
  { key: 'ai_receipt_extraction', label: 'AI Receipt OCR', icon: Zap, description: 'Extract receipt data using Anthropic VLM' },
  { key: 'ai_reports', label: 'AI Financial Reports', icon: Database, description: 'Generate insights with AI' },
  { key: 'api_access', label: 'API Access', icon: Shield, description: 'REST API for integrations' },
  { key: 'multi_entity', label: 'Multi-Entity', icon: Users, description: 'Manage multiple companies' },
];

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState<'subscription' | 'credits' | 'features'>('subscription');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Billing & Subscription</h1>
            <p className="text-muted-foreground">Manage your plan, credits, and feature access</p>
          </div>
          <Button variant="outline" asChild>
            <a href="/dashboard/billing/portal">
              <CreditCard className="mr-2 h-4 w-4" />
              Billing Portal
            </a>
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab as (value: string) => void} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="credits">Credits</TabsTrigger>
            <TabsTrigger value="features">Feature Gates</TabsTrigger>
          </TabsList>

          <TabsContent value="subscription">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Current Plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={`p-4 rounded-lg border ${mockSubscription.status === 'active' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <p className={`font-semibold ${mockSubscription.status === 'active' ? 'text-green-700' : 'text-gray-700'}`}>
                          {mockSubscription.status.charAt(0).toUpperCase() + mockSubscription.status.slice(1)}
                        </p>
                      </div>
                      <Badge variant={mockSubscription.status === 'active' ? 'default' : 'secondary'}>
                        {mockSubscription.plan.charAt(0).toUpperCase() + mockSubscription.plan.slice(1)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Period Start</p>
                        <p>{mockSubscription.currentPeriodStart ? formatDate(mockSubscription.currentPeriodStart) : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Period End</p>
                        <p>{mockSubscription.currentPeriodEnd ? formatDate(mockSubscription.currentPeriodEnd) : 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button className="w-full" asChild>
                      <a href="/dashboard/billing/portal">Manage Subscription</a>
                    </Button>
                    <Button variant="outline" className="w-full" asChild>
                      <a href="/dashboard/billing/checkout?plan=quarterly">Upgrade to Quarterly (Save 10%)</a>
                    </Button>
                    <Button variant="outline" className="w-full" asChild>
                      <a href="/dashboard/billing/checkout?plan=annual">Upgrade to Annual (Save 20%)</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pricing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { plan: 'Self-Hosted', price: '$0', period: '/month', features: ['Full feature access', 'Use your own API keys', 'No credit limits', 'Self-managed infrastructure'] },
                    { plan: 'Monthly', price: '$99', period: '/month', features: ['All hosted features', '1,000 credits/month', 'Plaid relay included', 'Priority support'] },
                    { plan: 'Quarterly', price: '$299', period: '/quarter', features: ['All monthly features', 'Save 10%', '3,000 credits/quarter', 'Priority support'] },
                    { plan: 'Annual', price: '$999', period: '/year', features: ['All monthly features', 'Save 20%', '12,000 credits/year', 'Priority support + dedicated CSM'] },
                  ].map(plan => (
                    <div key={plan.plan} className="p-4 rounded-lg border bg-muted/50">
                      <div className="flex items-baseline justify-between mb-2">
                        <h3 className="font-semibold text-lg">{plan.plan}</h3>
                        <div className="text-right">
                          <span className="text-3xl font-bold">{plan.price}</span>
                          <span className="text-muted-foreground">{plan.period}</span>
                        </div>
                      </div>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="credits">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Credit Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="text-5xl font-bold text-primary mb-2">{mockCreditBalance}</div>
                    <div className="text-muted-foreground">Credits Remaining</div>
                    <Button className="mt-4" asChild>
                      <a href="/dashboard/billing/purchase-credits">Purchase Credits</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Credit Transactions</CardTitle>
                  <Button asChild>
                    <a href="/dashboard/billing/purchase-credits">Purchase Credits</a>
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <div className="grid grid-cols-[120px_1fr_100px_100px_120px] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                      <div>Date</div>
                      <div>Reason</div>
                      <div>Description</div>
                      <div className="text-right">Amount</div>
                      <div className="text-right">Balance</div>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      {mockCreditTransactions.map(t => (
                        <div key={t.id} className="grid grid-cols-[120px_1fr_100px_100px_120px] gap-4 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
                          <div className="text-sm">{formatDate(t.createdAt)}</div>
                          <div>
                            <Badge variant="outline" className="text-xs capitalize">{t.reason.replace('_', ' ')}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">{t.description}</div>
                          <div className="text-right font-mono font-medium {t.amount > 0 ? 'text-green-600' : 'text-red-600'}">
                            {t.amount > 0 ? '+' : ''}{t.amount}
                          </div>
                          <div className="text-right text-sm font-medium text-muted-foreground">—</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="features">
            <Card>
              <CardHeader>
                <CardTitle>Feature Access</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {featureGates.map(feature => (
                    <div key={feature.key} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <feature.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{feature.label}</p>
                          <p className="text-sm text-muted-foreground">{feature.description}</p>
                        </div>
                      </div>
                      <Badge variant={feature.key === 'plaid_relay' ? 'default' : 'outline'}>
                        {feature.key === 'plaid_relay' ? 'Enabled' : 'Requires Credits'}
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