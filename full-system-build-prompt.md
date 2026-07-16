# Full System Build Prompt — Open-Source Accounting Engine

Copy everything below the line into Claude Code as the opening message for this repo. It covers the entire system across all six phases. The execution protocol at the end deliberately forces phase-by-phase delivery with test gates — do not let the agent skip ahead just because it has the full spec up front.

---

You are acting as a senior full-stack TypeScript engineer building an open-source, self-hostable double-entry accounting application end to end. This is a real project intended for production use. Accounting correctness (balanced entries, immutability, tenant isolation) is non-negotiable at every phase — never trade it for speed.

## Project

**License**: AGPL-3.0
**Mission**: An open-source QuickBooks alternative for freelancers/SMEs — double-entry ledger core, AR/AP invoicing, automated bank reconciliation, AI-native receipt ingestion, and native US Schedule C tax mapping.

## Fixed tech stack (do not substitute)

- Next.js 14+, App Router, TypeScript strict mode
- tRPC for all client↔server calls
- Drizzle ORM against PostgreSQL
- Auth.js (NextAuth), Postgres row-level security for tenant isolation
- Tailwind CSS
- Stripe (subscriptions + metered usage) for Phase 6
- Plaid for bank feeds (Phase 3), Anthropic API for receipt extraction (Phase 4)
- Inngest or Trigger.dev for background jobs (bank polling, receipt processing, recurring depreciation)
- Vitest (unit/property tests), Playwright (e2e)
- Docker Compose for local Postgres; Sentry for error tracking from day one

## Complete Database Schema

Implement all of the below in Drizzle, preserving every CHECK constraint, generated column, and foreign key exactly — do not simplify them away for convenience.

### Tenancy & Ledger Core

```sql
CREATE TYPE account_class_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE normal_balance_type AS ENUM ('debit', 'credit');

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    tax_identifier VARCHAR(100),
    base_currency CHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE company_users (
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL DEFAULT 'owner',
    PRIMARY KEY (company_id, user_id)
);

CREATE TABLE account_types (
    id SERIAL PRIMARY KEY,
    class account_class_type NOT NULL,
    name VARCHAR(100) NOT NULL,
    normal_balance normal_balance_type NOT NULL
);

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_type_id INT NOT NULL REFERENCES account_types(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uniq_company_account_code UNIQUE (company_id, code)
);

CREATE TABLE fiscal_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT check_fiscal_dates CHECK (start_date < end_date)
);

CREATE TABLE accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT check_period_dates CHECK (start_date < end_date)
);

CREATE TABLE journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL,
    CONSTRAINT uniq_company_journal_code UNIQUE (company_id, code)
);

CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id UUID NOT NULL REFERENCES journals(id),
    accounting_period_id UUID NOT NULL REFERENCES accounting_periods(id),
    entry_date DATE NOT NULL,
    posting_date DATE NOT NULL,
    reference_number VARCHAR(100),
    description TEXT,
    is_posted BOOLEAN NOT NULL DEFAULT FALSE,
    reversed_entry_id UUID REFERENCES journal_entries(id),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    description TEXT,
    debit DECIMAL(15, 4) NOT NULL DEFAULT 0.0000 CHECK (debit >= 0),
    credit DECIMAL(15, 4) NOT NULL DEFAULT 0.0000 CHECK (credit >= 0),
    signed_amount DECIMAL(15, 4) GENERATED ALWAYS AS (debit - credit) STORED,
    CONSTRAINT check_line_has_values CHECK (debit > 0 OR credit > 0),
    CONSTRAINT check_line_cannot_overlap CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE INDEX idx_lines_account_lookup ON journal_lines(account_id);
CREATE INDEX idx_lines_entry_relation ON journal_lines(journal_entry_id);
CREATE INDEX idx_entries_posting_date ON journal_entries(posting_date);
```

### AR / AP

```sql
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    payment_terms_days INT NOT NULL DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    invoice_number VARCHAR(50) NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft/sent/partial/paid/void
    subtotal DECIMAL(15,4) NOT NULL,
    tax_total DECIMAL(15,4) NOT NULL DEFAULT 0,
    total DECIMAL(15,4) NOT NULL,
    journal_entry_id UUID REFERENCES journal_entries(id),
    CONSTRAINT uniq_company_invoice_number UNIQUE (company_id, invoice_number)
);

CREATE TABLE invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(15,4) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,4) NOT NULL,
    revenue_account_id UUID NOT NULL REFERENCES accounts(id),
    amount DECIMAL(15,4) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE TABLE customer_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    payment_date DATE NOT NULL,
    amount DECIMAL(15,4) NOT NULL CHECK (amount > 0),
    bank_account_id UUID, -- FK added after bank_accounts table below
    journal_entry_id UUID REFERENCES journal_entries(id)
);

CREATE TABLE payment_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES customer_payments(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    applied_amount DECIMAL(15,4) NOT NULL CHECK (applied_amount > 0)
);

-- Bills / vendor_payments / vendor_payment_applications mirror the invoice tables above,
-- with expense_account_id instead of revenue_account_id on bill_lines. Implement in parallel.
```

### Banking

```sql
CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    ledger_account_id UUID NOT NULL REFERENCES accounts(id), -- the actual cash GL account
    plaid_item_id VARCHAR(255),
    plaid_access_token_encrypted TEXT, -- encrypt at application layer before insert
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    external_transaction_id VARCHAR(255), -- null for manual CSV imports
    posted_date DATE NOT NULL,
    amount DECIMAL(15,4) NOT NULL,
    description TEXT,
    raw_payload JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'unmatched', -- unmatched/matched/excluded
    matched_journal_entry_id UUID REFERENCES journal_entries(id),
    match_type VARCHAR(30) -- exact/split/tolerance/rule
);

CREATE TABLE reconciliation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    match_pattern VARCHAR(255) NOT NULL, -- merchant string match
    target_account_id UUID NOT NULL REFERENCES accounts(id),
    priority INT NOT NULL DEFAULT 100
);

ALTER TABLE customer_payments ADD CONSTRAINT fk_payment_bank_account
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id);
```

### Receipts / AI ingestion

```sql
CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    file_url TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending/processed/failed/approved
    extracted_data JSONB,
    draft_journal_entry_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Tax

```sql
CREATE TABLE schedule_c_lines (
    id VARCHAR(10) PRIMARY KEY,
    part INT NOT NULL,
    line_number VARCHAR(10) NOT NULL,
    label VARCHAR(255) NOT NULL,
    deductibility_limit DECIMAL(5,2) NOT NULL DEFAULT 1.00
);

ALTER TABLE accounts ADD COLUMN schedule_c_line_id VARCHAR(10) REFERENCES schedule_c_lines(id);

CREATE TABLE mileage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    log_date DATE NOT NULL,
    start_location VARCHAR(255),
    end_location VARCHAR(255),
    business_purpose TEXT NOT NULL,
    miles DECIMAL(10,2) NOT NULL CHECK (miles > 0),
    rate_used DECIMAL(6,4) NOT NULL, -- IRS standard rate for the tax year, never hardcode elsewhere
    deductible_amount DECIMAL(15,4) GENERATED ALWAYS AS (miles * rate_used) STORED
);
```

### Fixed assets

```sql
CREATE TABLE fixed_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    purchase_date DATE NOT NULL,
    cost DECIMAL(15,4) NOT NULL CHECK (cost > 0),
    salvage_value DECIMAL(15,4) NOT NULL DEFAULT 0,
    useful_life_years INT NOT NULL CHECK (useful_life_years > 0),
    method VARCHAR(20) NOT NULL DEFAULT 'straight_line',
    asset_account_id UUID NOT NULL REFERENCES accounts(id),
    accumulated_depreciation_account_id UUID NOT NULL REFERENCES accounts(id)
);

CREATE TABLE depreciation_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixed_asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
    accounting_period_id UUID NOT NULL REFERENCES accounting_periods(id),
    amount DECIMAL(15,4) NOT NULL,
    is_posted BOOLEAN NOT NULL DEFAULT FALSE,
    journal_entry_id UUID REFERENCES journal_entries(id)
);
```

### Billing

```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    plan VARCHAR(50) NOT NULL DEFAULT 'self_hosted',
    status VARCHAR(30) NOT NULL DEFAULT 'active'
);

CREATE TABLE credit_balances (
    company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    credits_remaining INT NOT NULL DEFAULT 0
);

CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    amount INT NOT NULL, -- negative for consumption, positive for purchase
    reason VARCHAR(50) NOT NULL, -- receipt_ocr/bank_sync/ai_report
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Audit

```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    before JSONB,
    after JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Cross-Cutting Invariants (enforce via Postgres triggers, not app code alone)

1. **Balanced posting**: on `journal_entries.is_posted` false→true, sum `journal_lines.signed_amount` for that entry; reject if non-zero or fewer than 2 lines.
2. **Immutability**: once posted, `journal_entries`/`journal_lines` cannot be updated or deleted — only reversed via a new linked entry (`reversed_entry_id`).
3. **Period locking**: reject insert/update/delete on `journal_lines` if the parent entry's period `is_closed = true`.
4. **Tenant isolation**: every table with `company_id` gets a Postgres row-level security policy scoping access to the requesting company — not just an app-level `WHERE` clause.
5. **Audit on mutation**: reversals, period closes, and any edit to posted-adjacent records write an `audit_log` row with before/after state.

## Module Requirements (implement in this order — see Execution Protocol)

### Phase 0 — Foundation
Auth.js sign-up/login, `companies`/`users`/`company_users`, empty dashboard shell, CI (lint+typecheck+test), Sentry wired in.

### Phase 1 — Ledger core
tRPC: `accounts.create/list/update/archive`, `journalEntries.createDraft/post/reverse`, `reports.trialBalance/profitAndLoss/balanceSheet`. UI: chart of accounts tree, journal entry form (disable Post until balanced), report pages.
**Tests**: unbalanced entry rejected; single-line entry rejected; posted entry immutable; reversal produces correct opposite entry; closed-period write rejected; trial balance always sums to zero (property-based).

### Phase 2 — AR/AP
tRPC: `customers`/`vendors` CRUD, `invoices.create/send/void`, `bills.create/approve`, `payments.applyToInvoices/applyToBills` (must support split across multiple invoices/bills). Posting an invoice/bill auto-generates the correct journal entry; applying a payment auto-generates the cash-clearing entry.
**Tests**: partial payment across 2 invoices allocates correctly; voiding an invoice reverses its journal entry; cash-basis P&L (computed via the accrual→cash query pattern, not a separate ledger) matches accrual P&L minus unpaid AR/AP for a fixture dataset.

### Phase 3 — Banking
Manual CSV/OFX import first — must work with zero external dependencies. Then the 4-pass reconciliation engine: (1) exact match on amount/currency/date ±3 days, (2) split match against sums of open invoices/bills, (3) tolerance match writing the difference to a bank-fees account, (4) merchant-string rules auto-posting to mapped accounts, falling through to an exceptions queue for manual review. Only after this works: Plaid integration with a dual path — self-hosters supply their own Plaid keys via env vars; hosted-tier users go through a relay service gated by the credits system.
**Tests**: each of the 4 passes has a fixture that proves it fires in the right order and only when prior passes don't match; unmatched transactions never silently auto-post.

### Phase 4 — AI receipts
Image upload → client-side preprocessing (deskew/contrast) → Anthropic API call using forced tool-calling with a Zod-validated schema (merchant, date, subtotal, tax, total, line items) → draft journal entry → user review/approve UI. Use prompt caching for the repeated system instructions/tool schema. Each successful extraction consumes credits from `credit_balances`.
**Tests**: malformed/low-confidence extractions are never auto-posted without review; a multi-receipt photo is split before extraction, not blended into one record.

### Phase 5 — Tax
Seed `schedule_c_lines` per the standard IRS categories; map `accounts.schedule_c_line_id`. Mileage log CRUD applying the correct year's IRS standard rate (configurable, never hardcoded in business logic). Fixed asset register with straight-line depreciation auto-posting monthly via the background job scheduler.
**Tests**: a full seeded tax year exports a Schedule C worksheet with correct line totals, including the 50% meals deductibility limit applied correctly.

### Phase 6 — Monetization
Stripe subscription checkout for hosted tier; credit pack purchase flow; feature flags gating Plaid-relay/AI-receipts behind sufficient credit balance; self-hosted deployments bypass all billing gates entirely (their own API keys, no metering).
**Tests**: a company with zero credits is blocked from AI receipt processing with a clear upgrade prompt, not a silent failure.

## Execution Protocol

- Build and verify **one phase at a time**, in the order above. Do not start Phase N+1 until Phase N's test suite is green.
- After finishing each phase, produce a short summary: what was built, what tests were added, any deviations from this spec and why, and what you'd recommend reviewing before moving on.
- Within a phase, sequence as: schema → triggers/invariants → tRPC layer → tests for the invariants → UI → integration tests.
- If a requirement here is ambiguous or you believe a different approach better preserves correctness, say so explicitly and propose the alternative — don't silently diverge.
- Never relax an invariant (balance check, immutability, tenant isolation) to make a later phase's feature easier to build. If a later phase seems to require it, stop and flag the conflict instead of resolving it unilaterally.
