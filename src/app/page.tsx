import Link from 'next/link';
import { Building2, BarChart3, CreditCard, Receipt, Banknote } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="container mx-auto px-4 py-8 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Building2 className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold">Accounting Engine</span>
        </div>
        <div className="flex gap-4">
          <Link href="/signin" className="text-sm text-muted-foreground hover:text-foreground">
            Sign In
          </Link>
          <Link href="/signup" className="text-sm font-medium text-primary hover:underline">
            Get Started
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            Double-Entry Accounting Made Simple
          </h1>
          <p className="text-xl text-muted-foreground mb-12">
            Open-source QuickBooks alternative for freelancers and SMEs.
            Track expenses, send invoices, and generate financial reports.
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <BarChart3 className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Financial Reports</h3>
              <p className="text-sm text-muted-foreground">
                Generate P&L, Balance Sheet, and Trial Balance reports in real-time.
              </p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <CreditCard className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Invoice Management</h3>
              <p className="text-sm text-muted-foreground">
                Create and track invoices with automatic payment application.
              </p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <Receipt className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Receipt OCR</h3>
              <p className="text-sm text-muted-foreground">
                Upload receipts and extract data with AI-powered OCR.
              </p>
            </div>
          </div>

          <Link href="/signup">
            <button className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
              Start Free Trial
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}