# Accounting Engine — Open-Source Double-Entry Accounting

An **AGPL-3.0**, self-hostable double-entry accounting system for freelancers and small businesses. Built with Next.js 16 (App Router), TypeScript strict mode, tRPC, Drizzle ORM + PostgreSQL, and Auth.js.

## Vision & Differentiators

- **Ledger core that cannot be corrupted** — invariants enforced at the database level via PostgreSQL triggers
- **Native cash-basis reporting** derived from an accrual-first core (no dual data models)
- **Automated bank reconciliation** via a 4-pass matching engine
- **AI-native receipt/invoice ingestion** via multimodal VLM extraction (Anthropic)
- **Native US Schedule C tax mapping** — the wedge no competitor in this space has built

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript (strict) |
| **API** | tRPC v11 (typed RPC) |
| **Database** | PostgreSQL + Drizzle ORM |
| **Auth** | Auth.js v5 (NextAuth) |
| **Styling** | Tailwind CSS v4 + Radix UI |
| **Payments** | Stripe (subscriptions + credits) |
| **Banking** | Plaid (bank feeds, dual-path per tenant or relay) |
| **AI** | Anthropic API (VLM receipt extraction) |
| **Background Jobs** | Inngest (bank sync, OCR, depreciation) |
| **File Storage** | AWS S3 |
| **Testing** | Vitest v4 + Playwright |
| **Observability** | Sentry |

## Architecture

```
┌── Next.js App Router ──────────────────────────────────────┐
│ ┌─ tRPC (typed RPC) ─────────────────────────────────────┐ │
│ │ Application Layer                                       │ │
│ │ Auth.js · Domain Services · Background Job Triggers     │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─ Drizzle ORM ──────────────────────────────────────────┐ │
│ │ PostgreSQL                                              │ │
│ │ Triggers enforce: balance, immutability, period locks,   │ │
│ │ tenant isolation (RLS)                                   │ │
│ └───────────┬─────────────────────────────────────────────┘ │
└─────────────┼───────────────────────────────────────────────┘
              │
  ┌───────────┼──────────────┬──────────────────┐
  │           │              │                  │
  ▼           ▼              ▼                  ▼
Plaid     Anthropic       Stripe             AWS S3
(bank     (VLM receipt    (billing,          (receipt
feeds)    extraction)     credits)           images)
```

## Project Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── (auth)/                 # Auth pages (signin, signup)
│   ├── (dashboard)/            # Protected dashboard pages
│   │   ├── chart-of-accounts/
│   │   ├── journal-entries/
│   │   ├── reports/
│   │   ├── customers/ vendors/
│   │   ├── invoices/ bills/
│   │   ├── payments/
│   │   ├── banking/
│   │   ├── receipts/
│   │   ├── tax/
│   │   ├── fixed-assets/
│   │   └── billing/
│   ├── api/
│   │   ├── auth/[...nextauth]/ # Auth.js API route
│   │   └── trpc/[trpc]/        # tRPC endpoint
│   ├── globals.css             # Tailwind + CSS variables
│   ├── layout.tsx              # Root layout with providers
│   └── page.tsx                # Landing page
├── components/
│   ├── ui/                     # Radix UI primitives (Button, Input, Card, etc.)
│   ├── providers.tsx           # Session, tRPC, QueryClient, Theme providers
│   ├── forms/                  # Form components (journal entry, invoice, etc.)
│   ├── reports/                # Financial report components
│   ├── banking/                # Reconciliation UI
│   └── tax/                    # Tax worksheet components
├── server/
│   ├── db/
│   │   ├── schema/            # Drizzle schema definitions (all domains)
│   │   ├── index.ts           # Database connection + RLS helpers
│   │   ├── triggers.ts        # Database triggers (balance, immutability, etc.)
│   │   └── rls.ts             # Row-level security policies
│   ├── trpc/
│   │   ├── context.ts         # tRPC context creation
│   │   ├── root.ts            # Root router
│   │   └── routers/           # Domain routers
│   │       ├── auth.ts        # Auth procedures
│   │       ├── company.ts     # Company/user management
│   │       ├── accounts.ts    # Chart of Accounts
│   │       ├── journalEntries.ts
│   │       ├── reports.ts     # Financial reports
│   │       ├── customers.ts vendors.ts
│   │       ├── invoices.ts bills.ts
│   │       ├── payments.ts
│   │       ├── bankAccounts.ts bankTransactions.ts
│   │       ├── reconciliation.ts
│   │       ├── receipts.ts ai.ts
│   │       ├── tax.ts mileage.ts fixedAssets.ts
│   │       └── billing.ts features.ts
│   └── jobs/                  # Inngest background job functions
├── lib/
│   ├── auth/
│   │   ├── index.ts           # Auth.js v5 configuration
│   │   ├── jwt.ts             # Custom JWT utilities
│   │   └── email.ts           # Email templates
│   └── utils.ts               # Helper functions (cn, formatCurrency, etc.)
├── proxy.ts                    # Next.js 16 Proxy (replaces middleware)
└── instrumentation.ts          # Sentry initialization
```

## Key Conventions

### Next.js 16 Notes

- **`proxy.ts` replaces `middleware.ts`**: In Next.js 16, middleware has been renamed to Proxy. Use `export function proxy(request)` instead of `export function middleware(request)`. See `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` for details.
- **`next.config.ts`**: Next.js 16 supports TypeScript config (`next.config.ts`) out of the box.
- **`eslint.config.mjs`**: Flat ESLint config format (ESLint v9+).
- **`postcss.config.mjs`**: ESM PostCSS config format.
- **`cookies()` and `headers()` are async**: In Next.js 16, `cookies()` and `headers()` from `next/headers` return Promises. Always `await` them.
- **`params` is a Promise**: In route handlers and pages, `params` is a Promise that must be awaited.

### Database Invariants (Non-Negotiable)

1. **Balanced posting**: Journal entries must have Σ signed_amount = 0 and ≥ 2 lines before posting
2. **Immutability**: Posted entries and their lines cannot be UPDATE/DELETE (only reversed via new entry)
3. **Period locking**: Writes rejected if parent entry's accounting period is closed
4. **Tenant isolation**: All `company_id` tables use RLS scoped to `current_setting('app.current_company_id')`
5. **Audit trail**: Reversals, period closes, and posted-adjacent edits write to `audit_logs` with before/after JSON

### API Design

- **tRPC for all API communication**: Typed RPC, no loose REST endpoints (except Auth.js and webhooks)
- **Procedure authorization hierarchy**: `publicProcedure` → `protectedProcedure` → `companyProcedure` → `adminProcedure` → `ownerProcedure`
- **RLS context set per request**: tRPC context creation sets `app.current_company_id` and `app.current_user_id` via `SET LOCAL`

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or Neon serverless)
- Docker (optional, for local PostgreSQL)

### Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd accounting-engine
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with DATABASE_URL, AUTH_SECRET, etc.

# 3. Start database (choose one)
# Option A: Docker
docker compose up -d
# Option B: Neon serverless (uses @neondatabase/serverless)

# 4. Generate and run migrations
npx drizzle-kit generate
npx drizzle-kit migrate

# 5. Seed demo data
npx tsx scripts/seed.ts

# 6. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo Credentials (after seeding)

- Email: `demo@accounting.engine`
- Password: `demo123456`

## Database Schema (Domain Summary)

| Domain | Tables | Purpose |
|---|---|---|
| Tenancy & Auth | `companies`, `users`, `company_users`, `auth_accounts`, `auth_sessions`, `auth_verification_tokens` | Multi-tenant root, role-based access |
| Chart of Accounts | `account_types`, `accounts` | Hierarchical COA with parent/child |
| Journal | `journals`, `journal_entries`, `journal_lines` | Core double-entry ledger |
| Periods | `fiscal_years`, `accounting_periods` | Fiscal period management |
| AR | `customers`, `invoices`, `invoice_lines`, `customer_payments`, `payment_applications` | Accounts receivable |
| AP | `vendors`, `bills`, `bill_lines`, `vendor_payments`, `vendor_payment_applications` | Accounts payable |
| Banking | `bank_accounts`, `bank_transactions`, `reconciliation_rules` | Bank feeds + reconciliation |
| AI Receipts | `receipts` | OCR extraction workflow |
| Tax | `schedule_c_lines`, `mileage_logs`, `fixed_assets`, `depreciation_schedules` | US Schedule C |
| Billing | `subscriptions`, `credit_balances`, `credit_transactions` | Stripe monetization |
| Audit | `audit_logs` | Immutable audit trail |

## tRPC API Reference

### Router Map

| Router | Procedures | Phase |
|---|---|---|
| `auth` | `signup`, `signin`, `signout`, `me`, `switchCompany`, `requestPasswordReset`, `resetPassword`, `verifyEmail` | 0 |
| `company` | `getCurrent`, `getAll`, `create`, `update`, `delete`, `inviteUser`, `removeUser`, `updateUserRole`, `getMembers`, `getSettings` | 0 |
| `accounts` | `create`, `list`, `update`, `archive`, `getTree` | 1 |
| `journalEntries` | `createDraft`, `post`, `reverse`, `list`, `getById` | 1 |
| `reports` | `trialBalance`, `profitAndLoss`, `balanceSheet` | 1 |
| `customers` | `create`, `list`, `update`, `delete`, `getById` | 2 |
| `vendors` | `create`, `list`, `update`, `delete`, `getById` | 2 |
| `invoices` | `create`, `send`, `void`, `list`, `getById`, `getLines` | 2 |
| `bills` | `create`, `approve`, `void`, `list`, `getById`, `getLines` | 2 |
| `payments` | `applyToInvoices`, `applyToBills`, `list`, `getById` | 2 |
| `bankAccounts` | `create`, `list`, `update`, `delete`, `sync`, `importCSV` | 3 |
| `bankTransactions` | `list`, `getById`, `match`, `exclude`, `review` | 3 |
| `reconciliation` | `runEngine`, `getRules`, `createRule`, `updateRule`, `deleteRule` | 3 |
| `receipts` | `upload`, `list`, `getById`, `process`, `approve`, `reject` | 4 |
| `ai` | `extractReceipt` (internal) | 4 |
| `tax` | `getScheduleCLines`, `mapAccount`, `getWorksheet`, `exportCSV` | 5 |
| `mileage` | `create`, `list`, `update`, `delete`, `getRates`, `setRate` | 5 |
| `fixedAssets` | `create`, `list`, `update`, `delete`, `generateSchedule`, `postDepreciation` | 5 |
| `billing` | `getSubscription`, `createCheckoutSession`, `createPortalSession`, `purchaseCredits`, `getCreditBalance`, `getCreditHistory` | 6 |
| `features` | `checkGate` (internal) | 6 |

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # ESLint
npx drizzle-kit generate  # Generate migrations
npx drizzle-kit migrate   # Run migrations
npx drizzle-kit studio    # Drizzle Studio
npx tsx scripts/seed.ts   # Seed demo data
npx vitest           # Run tests
npx playwright test  # Run E2E tests
```

## Security

- **Row Level Security (RLS)**: Every table with a `company_id` column has RLS policies scoped to the current company
- **Immutable Posted Entries**: Database triggers prevent modification of posted journal entries
- **Balanced Entries**: Posting triggers enforce double-entry bookkeeping invariants
- **Period Locking**: Closed accounting periods reject writes
- **Audit Logging**: All critical mutations captured with before/after JSONB snapshots

## License

AGPL-3.0. See [LICENSE](LICENSE) for details.

## Contributing

1. Read the [Full System Build Plan](./full-system-build-plan.md)
2. Follow the phase-based execution protocol (one phase at a time)
3. Within each phase: schema → triggers → tRPC → invariant tests → UI → integration tests
4. Never relax invariants — balance, immutability, and tenant isolation are non-negotiable

## Deployment

### Self-hosted (default)

Set `SELF_HOSTED=true` to bypass Stripe billing and use your own Plaid/Anthropic keys. All features unlocked.

### Hosted tier

Uses Stripe subscriptions and credit packs. Features gated:
- Plaid relay: credits > 0 per sync
- AI receipt extraction: credits > 0 per extraction
- AI reports: credits > 0 per report

### Docker

```bash
docker compose -f docker-compose.prod.yml up -d
```

### Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Auth.js encryption key |
| `SENTRY_DSN` | No | Error monitoring |
| `STRIPE_SECRET_KEY` | Hosted only | Payments |
| `PLAID_CLIENT_ID` | For banking | Bank feeds |
| `PLAID_SECRET` | For banking | Bank feeds |
| `ANTHROPIC_API_KEY` | For AI | Receipt extraction |
| `AWS_*` | For file uploads | S3 receipt storage |
| `INNGEST_EVENT_KEY` | For jobs | Background job runner |
| `SELF_HOSTED` | Optional | Bypass billing gates |